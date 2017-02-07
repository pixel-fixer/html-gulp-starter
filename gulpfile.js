
var gulp    = require('gulp'),
    gulpIf  = require('gulp-if'),
    stylus  = require('gulp-stylus'),
    connect = require('gulp-connect'),
    pug     = require('gulp-pug'),
    merge   = require('merge-stream'),
    path    = require('path');

/* DEPLOY / BUILD*/
var gulpif       = require('gulp-if'),
    autoprefixer = require('gulp-autoprefixer'),
    wiredep      = require('wiredep').stream,
    cleanCss     = require('gulp-clean-css'),
    uglify       = require('gulp-uglify'),
    rimraf       = require('gulp-rimraf'),
    useref       = require('gulp-useref'),
    sourcemaps   = require('gulp-sourcemaps'),
    rename       = require('gulp-rename'),
    insert       = require('gulp-insert'),
    cheerio      = require('gulp-cheerio'),
    gutil        = require('gulp-util'),
    replace      = require('gulp-replace'),
    plumber      = require('gulp-plumber'),
    ftp          = require('vinyl-ftp');
/* IMAGES*/
var spritesmith  = require('gulp.spritesmith'),
    imagemin     = require('gulp-imagemin'),
    svgSymbols   = require('gulp-svg-symbols');



// Error handler for gulp-plumber
function errorHandler(err) {
	gutil.log([ (err.name + ' in ' + err.plugin).bold.red, '', err.message, '' ].join('\n'));
	this.emit('end');
};

var SRC = './app';
var DEST = './dist';

var configs = {
  ftp: {
    host: "",
    username: "",
    pass: ""
  }
}

var options = {
	plumber: {
		errorHandler: errorHandler
	}
}

gulp.task("html", function () {
    gulp.src(SRC + '/*.html')
        .pipe(useref())
        .pipe(gulpif('*.js', uglify()))
        .pipe(gulpif('*.css',cleanCss()))
        .pipe(gulp.dest(DEST))
        .pipe(connect.reload());
});

gulp.task("stylus", function () {
    return gulp.src(SRC + '/styles/src/main.styl')
    .pipe(plumber(options.plumber))
    .pipe(stylus())
    .pipe(autoprefixer({
        browsers: ['last 3 versions']
    }))
    .pipe(gulp.dest(SRC + '/styles'))
    .pipe(connect.reload());
});

gulp.task("pug", function () {
    return gulp.src(SRC + '/views/*.jade')
    .pipe(plumber(options.plumber))
    .pipe(pug({
        pretty: true
    }))
    .pipe(replace('#TIME#', new Date().getTime()))
    .pipe(gulp.dest(SRC + '/'));
});

gulp.task("sprite", function () {
    var spriteData = gulp.src(SRC + '/img/sprite/*.png')
        .pipe(spritesmith({
            imgName: 'sprite.png',
            cssName: 'sprite.styl',
            cssFormat: 'stylus',
            imgPath: '../img/sprite.png',
            padding: 10,
            algorithm: 'top-down'
        }));

    var imgStream = spriteData.img;
    imgStream.pipe(gulp.dest(SRC + '/img/'));

    var cssStream = spriteData.css;
    cssStream.pipe(gulp.dest(SRC + '/styles/src/helpers'));

    return merge(imgStream, cssStream);
});


gulp.task('icons', function () {
  gulp.src(SRC + '/img/sprite/svg/*.svg')
        // remove all fill and style declarations in out shapes
    		.pipe(cheerio({
    			run: function ($) {
    				$('[fill]').removeAttr('fill');
    				$('[style]').removeAttr('style');
    			},
    			parserOptions: { xmlMode: true }
    		}))
      .pipe(svgSymbols({
        title: false,
        id: 'icon_%f',
        className: '%f',
        templates: [
          path.join(__dirname, SRC + '/styles/src/helpers/_svg-size-template.styl'),
          'default-svg'
        ]
      }))
      .pipe(gulpIf(/\.styl$/, rename('svg-size.styl')))
      .pipe(gulpIf(/\.styl$/, gulp.dest(SRC + '/styles/src/helpers/')))
      .pipe(gulpIf(/\.svg$/, rename('icons.svg')))
      .pipe(gulpIf(/\.svg$/, gulp.dest(SRC + '/img/')))
});

gulp.task('bower', ['pug'] ,function () {
  gulp.src(SRC + '/*.html')
    .pipe(wiredep({
      directory: SRC + '/bower_components'
    }))
    .pipe(gulp.dest(SRC))
    .pipe(connect.reload());
});

gulp.task('connect', function() {
  connect.server({
    root: 'app',
    livereload: true
  });
});

gulp.task('reload', function () {
    gulp.src(SRC+'/*.html').pipe(connect.reload());
});

gulp.task('watch', function() {
    gulp.watch(SRC + '/styles/src/*.*', ['stylus']);
    gulp.watch(SRC + '/*.html' , ['reload']);
    gulp.watch(SRC + '/js/*.js' , ['js']);
    gulp.watch('bower.json', ['bower']);
    gulp.watch(SRC + '/views/**/*.jade', ['pug','bower']);
    gulp.watch(SRC + '/views/*.jade', ['pug','bower']);
});

/* BUILD / DEPLOY */

gulp.task('clean', function () {
    gulp.src(DEST+'/*', { read: false })
    .pipe(rimraf());
});

gulp.task('images', function () {
   gulp.src([SRC + '/img/**/*.*', '!'+SRC+'/img/sprite/*.*']).pipe(imagemin([
     imagemin.gifsicle(), imagemin.jpegtran(), imagemin.optipng()
   ]))
    .pipe(gulp.dest(DEST+'/img/'));
});

gulp.task('css_copy', function () {
    gulp.src(SRC +'/styles/*.css')
    .pipe(gulp.dest(DEST + '/styles/'))
    .pipe(connect.reload());
});

gulp.task('css', function () {
    return gulp.src(SRC + '/styles/src/main.styl')
    .pipe(sourcemaps.init()) //TODO make correct internal sourcemaps
    .pipe(stylus())
    .pipe(autoprefixer({
        browsers: ['last 3 versions']
    }))
    .pipe(insert.prepend("/* this file is automatically generated by Stylus */\n\n"))
    .pipe(gulp.dest(SRC + "/styles/"))
    .pipe(gulp.dest(DEST+ "/styles/"))
    .pipe(cleanCss())
    .pipe(sourcemaps.write())
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest(DEST+ "/styles/"))
    .pipe(connect.reload());
});

gulp.task('js', function () {
    gulp.src(SRC +'/js/*.js')
    .pipe(gulp.dest(DEST + '/js/'))
    .pipe(connect.reload());
});

gulp.task('fonts', function () {
    gulp.src(SRC +'/fonts/*')
    .pipe(gulp.dest(DEST + '/fonts/'))
    .pipe(connect.reload());
});

gulp.task("deploy", function () {
  var conn = ftp.create( {
    host:     configs.ftp.host,
    user:     configs.ftp.username,
    password: configs.ftp.pass,
    parallel: 10,
    log:      gutil.log
  });

  var globs = [
        DEST + '/**',
    ];

  return gulp.src( globs, { base: DEST, buffer: false } )
    .pipe( conn.newer( '/' ) ) // only upload newer files
    .pipe( conn.dest( '/' ) );
});

//TODO task for other files

gulp.task('build',['html','js','css_copy', 'css','images','fonts']);

gulp.task('default', ['connect', 'watch']);
