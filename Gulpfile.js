var gulp = require('gulp');
var rev = require('./index');

gulp.task('test', function() {
    return gulp.src('test/**/*.html')
        .pipe(rev({
            assetsDir: 'test',
            remotePath:[{
                domain:"cdn.xxxx.com",
                path:"test"
            }],
            projectPath:"./"
        }))
        .pipe(gulp.dest('test'));
});
gulp.task('default', ["test"]);
