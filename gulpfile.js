import gulp from 'gulp'
import shell from 'gulp-shell'
import browserSync from 'browser-sync'

const bs = browserSync.create()

export default () => {
  bs.init({
    server: {
      baseDir: 'public',
    },
  })

  gulp.watch('public/**/*').on('change', bs.reload)

  gulp
    .watch(['layout/**/*', 'source/**/*'])
    .on('change', shell.task('npm run generate'))
}
