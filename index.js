/**!
 *
 * @Author alanzhang
 * @Date   2016/08/04
 * @overview
 *     1.改进gulp-rev-hash 插件，可读取指定cdn域下的文件，计算其hash值
 *     2.优化代码
 *
 * @原理 ：正则匹配出html文件中的css和js路径，根据其文件内容计算出hash值作为版本号
 *
 * @Link：gitlab:http://gitlab.futunn.com/webpackage/futu-gulp-rev.git
 *        github:https://github.com/outluch/gulp-rev-hash
 *
 */

var path = require('path');
var fs   = require('fs');
var EOL  = require('os').EOL;

var through = require('through2');
var gutil   = require('gulp-util');

module.exports = function(options) {
    options = options || {};

    //  hash标签的起始标签，在标签内的js及css会加上其hash值作为版本号
    var startReg = /<!--\s*rev\-hash\s*-->/gim,
        endReg   = /<!--\s*end\s*-->/gim;

    // js的正则匹配，仅匹配出js路径，不包括参数
    var jsReg = /<\s*script\s+.*?src\s*=\s*(?:'|")([^"']+.js).*(?:'|").*?>\s*<\s*\/\s*script\s*>/gi;

    // css的正则匹配，仅匹配出css路径，不包括参数
    var cssReg = /<\s*link\s+.*?href\s*=\s*(?:'|")([^"']+.css).*(?:'|").*?>/gi;

    // 是否指定了域名的本地路径
    var hasRemotePath,

    // {domain:path}格式
        domainPathMap,

    // 换行符的类型，根据用户使用的换行符类判断拼接的时候使用哪种换行符
        newLineSymbol;

    /**
     * [getFiles 根据正则表达式提取出js或者css路径]
     * @param  {String} content [html片段 ]
     * @param  {RegExp} reg     [description]
     * @return {Array}          [路径数组]
     */
    function getFiles(content, reg) {
        var paths = [];

        // 去掉注释部分，提取出js或者css路径
        // 保存完整的script标签和link标签以做备用
        content
            .replace(/<!--(?:(?:.|\r|\n)*?)-->/gim, '')
            .replace(reg, function(a, b) {
                paths.push({
                    path:b, // 路径
                    tag:a   // 完整标签
                });
            });

        return paths;
    }

    /**
     * [初始化参数，指定domain与路径的映射]
     * @return {[type]} [description]
     */
    (function() {

        // 项目的根路径，相对与gulpfile.js的路径
        var rootPath = path.resolve(options.projectPath || "../");

        domainPathMap = domainPathMap || {};

        // 包含domain 和 path的json数组
        options.remotePath = options.remotePath || [];

        // 资源文件目录的路径，node在读取静态文件时，会在文件路径前加上assetsDir
        options.assetsDir = options.assetsDir ? options.assetsDir : '';

        hasRemotePath = options.remotePath instanceof Array && options.remotePath.length > 0;

        for (var i = 0, domainLength = options.remotePath.length; i < domainLength; i++) {
            domainPathMap[options.remotePath[i].domain] = path.join(rootPath, options.remotePath[i].path);
        }

    })();

    /**
     * [filterRemotePath 根据静态资源的路径匹配出在本地的路径;如果使用了cdn则替换成本地路径，否则返回相对路径]
     * @param  {String} filepath [静态资源的路径]
     * @return {string}          [description]
     */
    function filterRemotePath(filepath) {

        if (hasRemotePath) {
            var domainStr = "",
                index_    = -1,
                tempPath  = "",
                domain    = "";

            // 判断静态资源的地址中是否包含指定的域名
            for (var iii = 0, domainLength = options.remotePath.length; iii < domainLength; iii++) {

                domain    = options.remotePath[iii].domain;
                domainStr = domain.replace(/\/$/,"");
                index_    = filepath.indexOf(domainStr);

                if (index_ > -1) {

                    // 将domain对应的路径与 静态资源文件的路径进行拼接，组成一个本地路径共fs进行读取
                    tempPath = path.join(domainPathMap[domain], filepath.substr(index_ + domainStr.length + 1));
                    // console.log(filepath + " ===> "+ tempPath);
                    return tempPath;
                }

            }

            // 未匹配到路径中使用的cdn
            return path.join(options.assetsDir, filepath);
        }

        // gulpfile中未对此组件设置域名配置
        return path.join(options.assetsDir, filepath);
    }

    /**
     * [description]
     * @param  {[type]}   file     [文件流]
     * @param  {[type]}   enc      [description]
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    return through.obj(function(file, enc, callback) {

        // 如果文件为空，不做任何操作，转入下一个操作，即下一个 .pipe()
        if (file.isNull()) {

            this.push(file);
            callback();

        // 插件不支持对 Stream 直接操作，跑出异常
        } else if (file.isStream()) {

            this.emit('error', new gutil.PluginError('gulp-usemin', 'Streams are not supported!'));
            callback();

        /*
         * 具体实现思路:
         * 1. 先根据<!-- end -->将html拆分成N段
         * 2. 对1-N的每一段再根据<!-- rev-hash -->进行拆分，得到2段，第一段为<!-- rev-hash -->前的内容，第二段为包含script和link标签的片段
         * 3. 将包含script和link标签的片段进行正则匹配得到其路径，并根据其路径读取其内容从而计算出hash值，作为其版本号
         * 4. 最后将各段重新拼接为完整的html
         */
        } else {

            var html = [],
                content = String(file.contents),
                sections = content.split(endReg);

            index = 0;
            // 判断当前文件中使用的换行符
            if (content.indexOf('\r\n') > -1) {
                newLineSymbol = '\r\n';
            } else if (content.indexOf('\n') > -1) {
                newLineSymbol = '\n';
            } else if (content.indexOf('\r') > -1) {
                newLineSymbol = '\r';
            }

            for (var i = 0, l = sections.length; i < l; ++i) {
                if (sections[i].match(startReg)) {
                    var assets, type;
                    var section = sections[i].split(startReg);
                    html.push(section[0]);
                    html.push('<!-- rev-hash -->' + newLineSymbol);

                    // 取<!-- rev-hash -->前面的空格或tab作为缩进
                    var indentMatch = section[0] && section[0].match(/( *|\t*)$/);
                    var indent      = indentMatch && indentMatch[1];

                    // section[1]为<!-- rev-hash -->和<!-- end -->包含的部分
                    var cssAssets = getFiles(section[1], cssReg);
                    var jsAssets  = getFiles(section[1], jsReg);

                    if (cssAssets.length > 0) {
                        assets = cssAssets;
                        type   = 'css'
                    } else {
                        assets = jsAssets;
                        type   = 'js'
                    }

                    // 针对js或者css路径集合进行文件读取并计算hash
                    for (var j = 0; j < assets.length; j++) {
                        asset = assets[j];

                        var tempPath = filterRemotePath(asset.path);

                        // 读取本地文件，根据其文件内容计算hash值
                        var hash = require('crypto')
                            .createHash('md5')
                            .update(fs.readFileSync(tempPath, {
                                encoding: 'utf8'
                            }))
                            .digest("hex");

                        if (type === 'css') {
                            html.push(indent + '<link rel="stylesheet" href="' + asset.path + '?v=' + hash + '">' + newLineSymbol);
                        } else {

                            // 仅仅只替换掉src部分，其他属性部分保留
                            var tag = asset.tag.replace(/src\s*=\s*(?:'|")([^"']+.js)[^'"]*(?:'|")/gi, function(tag, src) {
                                return 'src="' + src + '?v=' + hash + '"';
                            });

                            html.push(indent + tag + newLineSymbol);
                        }

                    }
                    html.push(indent + '<!-- end -->');

                } else {
                    html.push(sections[i]);
                }
            }

            file.contents = new Buffer(html.join(''));
            this.push(file);
            return callback();
        }
    });
};
