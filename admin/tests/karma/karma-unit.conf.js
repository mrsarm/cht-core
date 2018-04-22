module.exports = function(config) {

  'use strict';

  config.set({
    basePath: '../../',
    frameworks: ['mocha'],
    reporters: ['spec'],
    autoWatch: true,
    singleRun: false,
    colors: true,
    browserNoActivityTimeout: 60000,
    customLaunchers: {
      Chrome_Headless: {
        base: 'Chrome',
        flags: ['--headless', '--disable-gpu', '--remote-debugging-port=9222']
      }
    },
    files: [
      // used to query html
      'node_modules/jquery/dist/jquery.js',
      'node_modules/underscore/underscore.js',

      '../tests/karma/q.js',

      // application code
      '../dist/ddocs/medic-admin/_attachments/main.js',

      // test-specific code
      'node_modules/chai/chai.js',
      'node_modules/sinon/pkg/sinon.js',
      'node_modules/angular-mocks/angular-mocks.js',
      'tests/karma/utils.js',

      // test files
      'tests/karma/unit/**/*.js'
    ]
  });

};
