var gulp = require('gulp');
var rev = require('./index');

gulp.task('test', function() {
    return gulp.src('test/html/*.html')
        .pipe(rev({
            assetsDir: 'test/html',
            remotePath:[{
                domain:"cdn.xxxx.com",
                path:"test"
            }],
            projectPath:"./"
        }))
        .pipe(gulp.dest('test/html'));
});
gulp.task('default', ["test"]);
