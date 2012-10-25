var updates = require('kujua-sms/updates'),
    lists = require('kujua-sms/lists'),
    logger = require('kujua-utils').logger,
    baseURL = require('duality/core').getBaseURL(),
    appdb = require('duality/core').getDBURL(),
    querystring = require('querystring'),
    jsDump = require('jsDump'),
    fakerequest = require('couch-fakerequest'),
    helpers = require('../../test-helpers/helpers');


var example = {
    sms_message: {
       from: "+13125551212",
       message: '1!TEST!facility#2011#11#0#1#2#3#4#5#6#9#8#7#6#5#4',
       sent_timestamp: '01-19-12 18:45',
       sent_to: "+15551212",
       type: "sms_message",
       locale: "en",
       form: "TEST"
    },
    clinic: {
        "_id": "4a6399c98ff78ac7da33b639ed60f458",
        "_rev": "1-0b8990a46b81aa4c5d08c4518add3786",
        "type": "clinic",
        "name": "Example clinic 1",
        "contact": {
            "name": "Sam Jones",
            "phone": "+13125551212"
        },
        "parent": {
            "type": "health_center",
            "contact": {
                "name": "Neal Young",
                "phone": "+17085551212"
            },
            "parent": {
                "type": "district_hospital",
                "contact": {
                    "name": "Bernie Mac",
                    "phone": "+14155551212"
                }
            }
        }
    },
    days_stocked_out: {
        cotrimoxazole: 7,
        eye_ointment: 4,
        la_6x1: 9,
        la_6x2: 8,
        ors: 5,
        zinc: 6
    },
    quantity_dispensed: {
        cotrimoxazole: 3,
        eye_ointment: 6,
        la_6x1: 1,
        la_6x2: 2,
        ors: 5,
        zinc: 4
    }
};

var expected_callback = {
    data: {
        type: "data_record",
        form: "TEST",
        related_entities: {
            clinic: null
        },
        sms_message: example.sms_message,
        from: "+13125551212",
        errors: [],
        responses: [
          {
            to: "+13125551212",
            message: "Zikomo!"
          }
        ],
        tasks: [],
        days_stocked_out: example.days_stocked_out,
        quantity_dispensed: example.quantity_dispensed,
        facility_id:"facility",
        month: '11',
        year: '2011',
        misoprostol_administered: false
    }
};

/* improve messages function to better handle dot notation keys. */
var expected_tasks = [
    {
      "state": "pending",
      "messages": [
        {
          "to": "+14155551212",
          "message": "Health Facility Identifier: facility, Report Year: 2011, Report Month: 11, Misoprostol?: false, LA 6x1: Dispensed total: 1, LA 6x2: Dispensed total: 2"
        }
      ]
    }
];



/*
 * STEP 1:
 *
 * Run add_sms and expect a callback to add a clinic to a data record which
 * contains all the information from the SMS.
 **/
exports.test_to_record = function (test) {

    test.expect(26);

    // Data parsed from a gateway POST
    var data = {
        from: '+13125551212',
        message: '1!TEST!facility#2011#11#0#1#2#3#4#5#6#9#8#7#6#5#4',
        sent_timestamp: '01-19-12 18:45',
        sent_to: '+15551212'
    };

    // request object generated by duality includes uuid and query.form from
    // rewriter.
    var req = {
        uuid: '14dc3a5aa6',
        method: "POST",
        headers: helpers.headers("url", querystring.stringify(data)),
        body: querystring.stringify(data),
        form: data
    };

    var resp = fakerequest.update(updates.add_sms, data, req);
    
    var resp_body = JSON.parse(resp[1].body);
    
    // assert that we are parsing sent_timestamp
    test.same(
        'Thu Jan 19 2012',
        new Date(resp_body.callback.data.reported_date).toDateString()
    );
    
    test.equal(
        "18:45",
        new Date(resp_body.callback.data.reported_date)
            .toTimeString().match(/^18:45/)[0]
    );
    
    delete resp_body.callback.data.reported_date;
    
    test.same(
        resp_body.callback.options.path,
        baseURL + "/TEST/data_record/add/facility/%2B13125551212");
    
    test.same(
        resp_body.callback.data.days_stocked_out,
        expected_callback.data.days_stocked_out);
    
    test.same(
        resp_body.callback.data.quantity_dispensed,
        expected_callback.data.quantity_dispensed);
    
    test.same(
        resp_body.callback.data.sms_message,
        expected_callback.data.sms_message);
    
    test.same(
        resp_body.callback.data,
        expected_callback.data);
    
    facility_missing_error(test, helpers.nextRequest(resp_body, 'TEST'));

};


/*
 * STEP 2:
 *
 * Run data_record/add/facility and expect a response to contain facility error.
 */
var facility_missing_error = function(test, req) {

    var clinic = example.clinic;

    var viewdata = {rows: []};

    var resp = fakerequest.list(lists.data_record, viewdata, req);

    var resp_body = JSON.parse(resp.body);

    test.same(
        resp_body.callback.data.errors,
        [
            {
                "code":"facility_not_found",
                "message":"Facility not found."
            },
            {
                "code":"recipient_not_found",
                "message":"Could not find message recipient."
            }
        ]
    );

    messages_task_result(test, req);
};

/*
 * Check messages task result.
 */
var messages_task_result = function(test, req) {

    var clinic = example.clinic;

    var viewdata = {rows: [
        {
            "key": ["+13125551212"],
            "value": clinic
        }
    ]};

    var resp = fakerequest.list(lists.data_record, viewdata, req);

    var resp_body = JSON.parse(resp.body);

    test.same(resp_body.callback.data.tasks, expected_tasks);

    uses_update_path(test, req);
};


/*
 * Run data_record/add/facility and expect a callback to
 * check if the same data record already exists with existing clinic.
 */
var uses_update_path = function(test, req) {

    var clinic = example.clinic;

    var viewdata = {rows: [
        {
            "key": ["+13125551212"],
            "value": clinic
        }
    ]};

    var resp = fakerequest.list(lists.data_record, viewdata, req);

    var resp_body = JSON.parse(resp.body);

    test.same(
        resp_body.callback.options.path,
        baseURL + "/TEST/data_record/merge/2011/11/" + clinic._id);

    test.same(
        resp_body.callback.data.related_entities,
        {clinic: clinic});

    test.same(resp_body.callback.data.errors, []);

    record_exists_case(test, helpers.nextRequest(resp_body, 'TEST'),
        record_does_not_exist_case, [test, helpers.nextRequest(resp_body, 'TEST')]);

};



/**
 * CASE 1: A data record already exists.
 *
 * Run data_record/merge/year/month/clinic_id and expect a callback to update
 * the data record with the new data.
 *
 * @param {Object} test     - Unittest object
 * @param {Object} req      - Callback object used to form the next request
 * @param {Function} finish - Last callback where test.done() is called
 * @param {Array} args      - Args for last callback
 * @api private
 */
var record_exists_case = function(test, req, finish, args) {

    var viewdata = {rows: [
        {
            key: ["2011", "11", "4a6399c98ff78ac7da33b639ed60f458"],
            value: {
                _id: "777399c98ff78ac7da33b639ed60f422",
                _rev: "484399c98ff78ac7da33b639ed60f923"
            }
        }
    ]};

    var resp = fakerequest.list(lists.data_record_merge, viewdata, req);
    var resp_body = JSON.parse(resp.body);

    // main tests
    test.same(
        resp_body.callback.data._rev,
        "484399c98ff78ac7da33b639ed60f923");

    test.same(
        resp_body.callback.options.path,
        appdb + "/777399c98ff78ac7da33b639ed60f422");

    test.same(
        resp_body.callback.options.method,
        "PUT");

    // extra checks
    test.same(
        resp_body.callback.data.quantity_dispensed,
        expected_callback.data.quantity_dispensed);

    test.same(
        resp_body.callback.data.sms_message,
        expected_callback.data.sms_message);

    test.same(
        resp_body.callback.data.related_entities,
        {clinic: example.clinic});

    test.same(resp_body.callback.data.errors, []);
    test.same(resp_body.callback.data.tasks, expected_tasks);

    if (typeof finish === 'function') {
        finish.apply(this, args);
    }
};


/**
 * CASE 2: A data record does not exist.
 *
 * Run data_record/merge/year/month/clinic_id and expect a callback to create a
 * new data record.
 */
var record_does_not_exist_case = function(test, req) {

    var viewdata = {rows: []};

    var resp = fakerequest.list(lists.data_record_merge, viewdata, req);

    var resp_body = JSON.parse(resp.body);

    // If no record exists during the merge then we create a new record with
    // POST
    test.same(resp_body.callback.options.method, "POST");
    test.same(resp_body.callback.options.path, appdb);

    // extra checks
    test.same(resp_body.callback.data.errors, []);
    test.same(
        resp_body.callback.data.sms_message,
        example.sms_message);
    test.same(
        resp_body.callback.data.days_stocked_out,
        example.days_stocked_out);
    test.same(
        resp_body.callback.data.quantity_dispensed,
        example.quantity_dispensed);

    test.done();
};
