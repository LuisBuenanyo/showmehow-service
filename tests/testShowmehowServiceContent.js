// tests/js/testShowmehowServiceContent.js
//
// Copyright (c) 2016 Endless Mobile Inc.
// All Rights Reserved.
//
// These tests actually exercise all the lessonsto make sure that
// they return the intended response. The ordering of tests here
// between lessons matters.
//
// Note that this requires showmehow-service to be running on your
// system, so it makes sense only as an installed test.

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

const Controller = imports.lib.controller;
const Descriptors = imports.lib.descriptors;
const Mocks = imports.mocks.constructors;

// sortExampleKeys
//
// We need to do this here to ensure that 'failure' always comes before
// 'success'. The reason is that we might be relying on the ordering of
// tasks especially in lessons that have some sort of context. For
// instance, if the 'success' example and the 'failure' example both
// assign the same variable name.
function sortExampleKeys(keys) {
    return keys.sort(function(left, right) {
        if (left === "failure") {
            return -1;
        } else if (right === "failure") {
            return 1;
        } else {
            return left < right ? -1 : right > left;
        }
    });
}

// getTopLevelSourceDirectory
//
// This (somewhat horrible) hack reads the last element on the ARGV from
// jasmine to determine the path this file. It then resolves that as
// an absolute path, gets the directory name and goes one level up
// to determine where the source directory is. This is required in
// the distcheck case where we rely on files in the source directory
// and the interpreter is running in the build directory.
function getTopLevelSourceDirectory() {
    return Gio.File.new_for_path(ARGV[ARGV.length - 1]).get_parent().get_parent().get_path();
}

describe('Showmehow Service Lesson', function () {
    let controller, service;
    let [defaultLessons, warnings] = Descriptors.loadLessonDescriptorsFromFile(Gio.File.new_for_path('data/lessons.json'));

    /* Set the 'warnings' key, since this is what ShowmehowController expects internally */
    defaultLessons.warnings = warnings;

    beforeAll(function () {
        GLib.setenv('GSETTINGS_BACKEND', 'memory', true);
        GLib.setenv('PATH', GLib.getenv('PATH') + ':/usr/games', true);
        GLib.setenv('CODING_SOURCE_FILES_DIR',
                    GLib.build_filenamev([getTopLevelSourceDirectory(), 'files']),
                    true);
        GLib.setenv('CODING_TARGET_FILES_DIR', GLib.dir_make_tmp('showmehow-service-test-XXXXXX'), true);
        service = new Mocks.ChatServiceStub();
        controller = new Controller.ShowmehowController(defaultLessons, null, service);
    });

    defaultLessons.forEach(function(lesson) {
        describe(lesson.name, function() {
            let session = -1;
            beforeAll(function() {
                if (lesson.requires_session)
                    session = service.openSession(lesson.name);
            });

            afterAll(function() {
                if (session !== -1)
                    service.closeSession(session);
            });

            Object.keys(lesson.practice).forEach(function(taskName) {
                describe(taskName, function() {
                    let task = lesson.practice[taskName];
                    sortExampleKeys(Object.keys(task.example)).forEach(function(result) {
                        let input = task.example[result];
                        it('returns ' + result + ' when called with ' + input, function(done) {
                            let errorHandler = function(domain, code, message) {
                                throw new Error('Error ' + domain + ':' + code + ' "' + message + '" occurred');
                            };

                            let successHandler = function(response) {
                                expect(response.result).toEqual(result);
                                done();
                            }

                            let response = service.attemptLessonWithInput(session,
                                                                          lesson.name,
                                                                          taskName,
                                                                          input,
                                                                          errorHandler,
                                                                          successHandler);
                        });
                    });
                });
            });
        });
    });
});
