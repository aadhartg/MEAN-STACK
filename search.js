'use strict';
/**
 * Importing all the nesessory modules
*/
let _ = require('lodash');
let promise = require('bluebird');
let getenv = require('getenv');
let request = require('request-promise');
let dateFormat = require('dateformat');
let searchBaseUrl = getenv('SEARCH_URL');
let databaseName = getenv('MONGO_DB_DATABASE');
let customError = require('../shared/custom-error');
let addressHelper = require('../api/helpers/address-details');
let EventsModel = require('../models/events').eventModel;
let EventsfyFanModel = require('../models/eventsfy-fans').eventsfyFanModel;
let eventsfyFansType = require('../models/eventsfy-fans').eventsfyFansType;
let eventsfyFansStatus = require('../models/eventsfy-fans').eventsfyFansStatus;
let categoriesModel = require('../models/categories');

/**
 * Exporting the module so that we can use them in other modules
 */
module.exports = {
  getSearchData: getSearchData,
  getAutoCompleteSearchResult: getAutoCompleteSearchResult,
  getFilterSearchData: getFilterSearchData,
  getCategoriesListAggregation: getCategoriesListAggregation,
  getSearchDataByKeyWord: getSearchDataByKeyWord,
  getFansCountByType: getFansCountByType,
  getEventFanCounts: getEventFanCounts,
  getVenueFanCounts: getVenueFanCounts,
  getArtistFanCounts: getArtistFanCounts,
  getEventsNearLocation: getEventsNearLocation,
  getAdvanceFilterSearchData: getAdvanceFilterSearchData,
  searchEventOfArtistVenue: searchEventOfArtistVenue,
  searchStubhubEvents: searchStubhubEvents,
  getStubhubAdvanceFilter: getStubhubAdvanceFilter,
  getPromotedAndStubhubEvents:getPromotedAndStubhubEvents,
  getAdvanceFilterSearchPromotedData:getAdvanceFilterSearchPromotedData,
  getMultipleTickets: getMultipleTickets,
  getUpComingEvents: getUpComingEvents

};

/**
 * getSearchData - search events, venues, artists by keyword
 *
 * @param  {string} SearchKeyWord search key word
 * @param {boolean} ShowPast      get past events if showPast is true
 * @param  {function} cb          callback function
 * @return {array}                array of objects
 */
function getSearchData(SearchKeyWord, ShowPast, pageSize, pageNumber, cb) {
  let searchFor = (ShowPast) ? 'events' : 'events,artists,venues';
  let searchUrl = searchBaseUrl + '/' + databaseName + '/' + searchFor + '/_search';
  let dateQuery = (ShowPast) ? {
    'lt': 'now'
  } : {
      'gte': 'now'
    };
  let pageStartFrom = ((pageNumber - 1) * pageSize);
  let options;
  if (_.isEmpty(SearchKeyWord)) {
    options = {
      method: 'POST',
      uri: searchUrl,
      body: {
        'size': pageSize,
        'from': pageStartFrom,
        'query': {
          'bool': {
            'filter': [{
              'nested': {
                'path': 'event_schedule',
                'query': {
                  'range': {
                    'event_schedule.start_date': {
                      'gte': 'now'
                    }
                  }
                }
              }
            },
            {
              'term': {
                'status': 1
              }
            }
            ]
          }
        },
        'sort': [{
          'event_schedule.start_date': {
            'order': 'desc',
            'mode': 'min',
            'nested_path': 'event_schedule',
            'nested_filter': {
              'range': {
                'event_schedule.start_date': {
                  'gte': 'now'
                }
              }
            }
          }
        }]
      },
      json: true // Automatically stringifies the body to JSON
    };
  } else {
    options = {
      method: 'POST',
      uri: searchUrl,
      body: {
        'size': pageSize,
        'from': pageStartFrom,
        'query': {
          'bool': {
            'minimum_number_should_match': 1,
            'should': [{
              'nested': {
                'path': 'venue',
                'query': {
                  'multi_match': {
                    'query': SearchKeyWord,
                    'fields': [
                      'venue.name',
                      'venue.zip',
                      'venue.city',
                      'venue.state',
                      'venue.description'
                    ],
                    'operator': 'and'
                  }
                }
              }
            },
            {
              'nested': {
                'path': 'artists',
                'query': {
                  'multi_match': {
                    'query': SearchKeyWord,
                    'fields': [
                      'artists.name'
                    ],
                    'operator': 'and'
                  }
                }
              }
            },
            {
              'multi_match': {
                'query': SearchKeyWord,
                'fields': [
                  'name',
                  'description',
                  'city',
                  'zip',
                  'state',
                  'address_line1'
                ],
                'operator': 'and'
              }
            }
            ],
            'filter': [{
              'term': {
                'status': 1
              }
            }]
          }
        },
        'aggs': {
          'types': {
            'terms': {
              'field': '_type'
            }
          }
        },
        'sort': [{
          '_script': {
            'script': 'if(doc[\'_type\'].value==\'events\'){return 0;}else if(doc[\'_type\'].value==\'artists\'){ return 1}else{ return 2}',
            'type': 'number',
            'order': 'asc'
          }
        },
        {
          'event_schedule.start_date': {
            'order': 'desc',
            'mode': 'min',
            'nested_path': 'event_schedule',
            'nested_filter': {
              'range': {
                'event_schedule.start_date': dateQuery
              }
            }
          }
        }
        ]
      },
      json: true // Automatically stringifies the body to JSON
    };
  }

  request(options)
    .then((result) => {
      cb(null, result);
    })
    .catch((err) => cb(err));
}

/**
 * Function is used to display the autocomplete results so that user can select options from the list
 * @param {*} searchKeyWord  search key word
 * @param {*} type           search type eg. venue/event
 * @param {*} pageSize       total number of page (Integer)
 * @param {*} pageNumber     current page number
 * @param {*} cb             call back function
 */
function getAutoCompleteSearchResult(searchKeyWord, type, pageSize, pageNumber, cb) {
  let data;
  if (type === 'event') {
    data = _getEventAutoCompleteQuery(pageSize, searchKeyWord);
  } else if (type === 'venue') {
    data = _getVenueAutoCompleteQuery(pageSize, searchKeyWord);
  } else if (type === 'city') {
    data = _getCityAutoCompleteQuery(pageSize, searchKeyWord);
  } else if (type === 'artist') {
    data = _getArtistAutoCompleteQuery(pageSize, searchKeyWord);
  }

  if (!_.isEmpty(searchKeyWord)) {
    let options = {
      method: 'POST',
      uri: data.url,
      body: data.query,
      json: true
    };
     request(options)
      .then((result) => {
        cb(null, result);
      })
      .catch((err) => cb(err));
  } else {
    cb();
  }
}

/**
 * Function is used to get the sugesttions for the Venue search
 * @param {*} pageSize        total number of page (Integer)
 * @param {*} searchKeyWord   search key word
 */
function _getVenueAutoCompleteQuery(pageSize, searchKeyWord) {
  let url = searchBaseUrl + '/' + databaseName + '/events,venues/_search';
  let query = {
    "size": 0,
    "query": {
      "bool": {
        "minimum_number_should_match": 1,
        "should": [
          {
            "nested": {
              "path": "venue",
              "query": {
                "query_string": {
                  "query": '*' + _.toLower(searchKeyWord) + '*',
                  "fields": [
                    "venue.city",
                    "venue.zip"
                  ],
                  "default_operator": "and"
                }
              }
            }
          },
          {
            "bool": {
              "must": [
                {
                  "query_string": {
                    "query": '*' + _.toLower(searchKeyWord) + '*',
                    "fields": [
                      "name",
                      "zip"
                    ],
                    "default_operator": "and"
                  }
                },
                {
                  "match": {
                    "_type": "venues"
                  }
                }
              ]
            }
          }
        ],
        "filter": [
          {
            "term": {
              "status": 1
            }
          }
        ]
      }
    },
    "aggs": {
      "event_venue_aggregation": {
        "nested": {
          "path": "venue"
        },
        "aggs": {
          "name1_aggregation": {
            "terms": {
              "field": "venue.name.untouched"
            },
            "aggs": {
              "agg3": {
                "terms": {
                  "field": "venue.id"
                }
              }
            }
          }
        }
      },
      "venue_aggregation": {
        "filter": {
          "term": {
            "_type": "venues"
          }
        },
        "aggs": {
          "name_aggregation": {
            "terms": {
              "field": "name.untouched"
            },
            "aggs": {
              "image_aggregation": {
                "nested": {
                  "path": "images"
                },
                "aggs": {
                  "image_aggregation": {
                    "terms": {
                      "field": "images.thumb_url.untouched"
                    }
                  }
                }
              },
              "url_aggregation": {
                "terms": {
                  "field": "url.untouched"
                }
              }
            }
          }
        }
      }
    }
  };

  return {
    url,
    query
  };
}

/**
 * Function is used to get the sugesttions for the Artist search
 * @param {*} pageSize      total number of page (Integer)
 * @param {*} searchKeyWord search key word
 */
function _getArtistAutoCompleteQuery(pageSize, searchKeyWord) {
  let url = searchBaseUrl + '/' + databaseName + '/events,artists/_search';
  let query = {
    "size": 0,
    "query": {
      "bool": {
        "minimum_number_should_match": 1,
        "should": [
          {
            "nested": {
              "path": "artists",
              "query": {
                "query_string": {
                  "query": '*' + _.toLower(searchKeyWord) + '*',
                  "fields": [
                    "artists.name"
                  ],
                  "default_operator": "and"
                }
              }
            }
          },
          {
            "bool": {
              "must": [
                {
                  "multi_match": {
                    "query": '*' + _.toLower(searchKeyWord) + '*',
                    "fields": [
                      "name"
                    ],
                    "operator": "and"
                  }
                },
                {
                  "match": {
                    "_type": "artists"
                  }
                }
              ]
            }
          }
        ],
        "filter": [
          {
            "term": {
              "status": 1
            }
          }
        ]
      }
    },
    "aggs": {
      "event_artist_aggregation": {
        "nested": {
          "path": "artists"
        },
        "aggs": {
          "event_artists_name_aggregation": {
            "terms": {
              "field": "artists.name.untouched",
              "size": 4
            },
            "aggs": {
              "event_artists_id_aggregation": {
                "terms": {
                  "field": "artists.id"
                }
              }
            }
          }
        }
      },
      "artists_aggregation": {
        "filter": {
          "bool": {
            "must": [
              {
                "term": {
                  "_type": "artists"
                }
              },
              {
                "nested": {
                  "path": "images",
                  "query": {
                    "bool": {
                      "must": [
                        {
                          "exists": {
                            "field": "images.thumb_url"
                          }
                        }
                      ],
                      "must_not": {
                        "term": {
                          "images.thumb_url.untouched": ""
                        }
                      }
                    }
                  }
                }
              }
            ]
          }
        },
        "aggs": {
          "artists_name_aggregation": {
            "terms": {
              "size": 100000,
              "field": "name.untouched"
            },
            "aggs": {
              "artist_image_aggregation": {
                "nested": {
                  "path": "images"
                },
                "aggs": {
                  "artist_nested_image_aggregation": {
                    "terms": {
                      "field": "images.thumb_url.untouched"
                    }
                  }
                }
              },
              "url_aggregation": {
                "terms": {
                  "field": "url.untouched"
                }
              }
            }
          }
        }
      }
    }
  };

  return {
    url,
    query
  };
}

/**
 * Function is used to get the sugesttions for the Event search
 * @param {*} pageSize      total number of page (Integer)
 * @param {*} searchKeyWord search key word
 */
function _getEventAutoCompleteQuery(pageSize, searchKeyWord) {
  var today = dateFormat(new Date().toUTCString(), "yyyy-mm-dd");
  let fromDate = new Date(today);
  let toDate = new Date(today);
  toDate.setDate(toDate.getDate() + 1);

  fromDate = dateFormat(fromDate.toUTCString(), "yyyy-mm-dd'T'HH:MM:ss");
  toDate = dateFormat(toDate.toUTCString(), "yyyy-mm-dd'T'HH:MM:ss");

  let url = searchBaseUrl + '/' + databaseName + '/events/_search';
  let query = {
    'size': pageSize,
    "_source": [
      "name",
      "categories",
      "images",
      "url",
      "event_schedule.start_date"
    ],
    "query": {
      "bool": {
        "minimum_number_should_match": 1,
        "should": [
          {
            "query_string": {
              "query": '*' + searchKeyWord + '*',
              "fields": ["name"],
              "default_operator": "and"
            }
          }
        ],
        "filter": [
          {
            "term": {
              "status": 1
            }
          },
          {
            "nested": {
              "path": "event_schedule",
              "query": {
                "range": {
                  "event_schedule.start_date": {
                    "gte": fromDate,
                    "lt": toDate
                  }
                }
              }
            }
          }
        ]
      }
    },
    "sort": [
      {
        "event_schedule.start_date": {
          "order": "desc",
          "mode": "min",
          "nested_path": "event_schedule",
          "nested_filter": {
            "range": {
              "event_schedule.start_date": {
                "gte": "now"
              }
            }
          }
        }
      }
    ]
  };
  return {
    url,
    query
  };
}

/**
 * Function is used to get the sugesttions for the city search
 * @param {*} pageSize      total number of page (Integer)
 * @param {*} searchKeyWord search key word
 */
function _getCityAutoCompleteQuery(pageSize, searchKeyWord) {
  let url = searchBaseUrl + '/' + databaseName + '/events/_search';
  let query = {
    "size": 0,
    "query": {
      "bool": {
        "minimum_number_should_match": 1,
        "should": [
          {
            "nested": {
              "path": "venue",
              "query": {
                "query_string": {
                  "query": '*' + _.toLower(searchKeyWord) + '*',
                  "fields": [
                    "venue.city",
                    // "venue.zip"
                  ],
                  "default_operator": "and"
                }
              }
            }
          }
        ],
        "filter": [
          {
            "term": {
              "status": 1
            }
          }
        ]
      }
    },
    "aggs": {
      "event_venuecity_aggregation": {
        "nested": {
          "path": "venue"
        },
        "aggs": {
          "buckets" : {
            "terms" : {
  			      "script" : "doc['venue.city.untouched'].value.toLowerCase()",
              "size": pageSize

            }
          }
        }
      }
    }
  };

  return {
    url,
    query
  };
}

/**
 * getFilterSearchData - perform search for filters
 *
 * @param  {array} data filters array contains below fields
                        {'type': 'event',
                        'city': 'Chicago',
                        'state': 'IL',
                        'zip': '60601',
                        'radius': '50',
                        'fromDate': '2017-06-21T00:00:00',
                        'category': 'all'}
 * @param  {type} cb   callback function
 * @return {type}      array of objects
 */
function getFilterSearchData(data, pageSize, pageNumber, cb) {
  // Validate the address cordinates
  let address = _.values(_.pick(data, ['city', 'state', 'zip'])).join(' ');
  let pageStartFrom = ((pageNumber - 1) * pageSize);
  return addressHelper.getCoordinatesGoogleAsync(address,false)
    .then((cordinates) => {
      if (cordinates['lat'] === 0 && cordinates['lon'] === 0) {
        cb(new customError({ 'custom_error': 'badData', 'message': 'Invalid Address.' }));
      }
      return {
        'lat': cordinates['lat'],
        'lon': cordinates['lon']
      };
    })
    .then((venue_location) => {
      let dateFrom = new Date(data.fromDate).toUTCString();
      let fromDate = dateFormat(dateFrom, "yyyy-mm-dd'T'HH:MM:ss");
      let radius = data.radius + 'mi'; //radius unit is miles. We are attaching unit 'mi' for radius
      let category = data.category;
      let venueQuery = {};

      if (data.category == 'all') {
        category = '*';
      }

      if (!data.showAll) {
        venueQuery = {
          'bool': {
            'should': [{
              'nested': {
                'path': 'venue',
                'query': {
                  'geo_distance': {
                    'distance': radius,
                    'venue.location': venue_location
                  }
                }
              }
            }]
          }
        };
      }

      let searchUrl = searchBaseUrl + '/' + databaseName + '/events/_search';

      let options = {
        method: 'POST',
        uri: searchUrl,
        body: {
          'size': pageSize,
          'from': pageStartFrom,
          'query': {
            'bool': {
              'filter': [{
                'nested': {
                  'path': 'event_schedule',
                  'query': {
                    'range': {
                      'event_schedule.start_date': {
                        'gte': fromDate
                      }
                    }
                  }
                }
              },
              {
                'nested': {
                  'path': 'categories',
                  'query': {
                    'wildcard': {
                      'categories.name.untouched': category
                    }
                  }
                }
              },
              {
                'term': {
                  'status': 1
                }
              },
                venueQuery
              ]
            }
          },
          'sort': [{
            'event_schedule.start_date': {
              'order': 'desc',
              'mode': 'min',
              'nested_path': 'event_schedule',
              'nested_filter': {
                'range': {
                  'event_schedule.start_date': {
                    'gte': fromDate
                  }
                }
              }
            }
          },
          {
            '_geo_distance': {
              'nested_path': 'venue',
              'venue.location': venue_location,
              'order': 'asc',
              'unit': 'mi',
              'distance_type': 'plane'
            }
          }
          ]
        },
        json: true // Automatically stringifies the body to JSON
      };
      request(options)
        .then((result) => {
          cb(null, result);
        })
        .catch((err) => cb(err));
    })
    .catch((err) => cb(err));
}

/**
 * getCategoriesListAggregation - get list of categories with event count for particular category
 *
 * @param  {type} cb callback function
 * @return {type}    returns list of categories with event count for particular category
 */
function getCategoriesListAggregation(cb) {
  let searchUrl = searchBaseUrl + '/' + databaseName + '/events/_search';
  let options = {
    method: 'POST',
    uri: searchUrl,
    body: {
      'size': 0,
      'query': {
        'bool': {
          'filter': [{
            'nested': {
              'path': 'event_schedule',
              'query': {
                'range': {
                  'event_schedule.start_date': {
                    'gte': 'now'
                  }
                }
              }
            }
          },
          {
            'term': {
              'status': 1
            }
          }]
        }
      },
      'aggs': {
        'categories': {
          'nested': {
            'path': 'categories'
          },
          'aggs': {
            'types': {
              'terms': {
                'size': 100000,
                'field': 'categories.name.untouched'
              }
            }
          }
        }
      }
    },
    json: true // Automatically stringifies the body to JSON
  };
  request(options)
    .then((result) => {
      cb(null, result);
    })
    .catch((err) => cb(err));
}


/**
 * 
 * @param {*} SearchKeyWord  search key word, filled by the user
 * @param {*} searchFor      this is options eg. venue/event
 * @param {*} pageSize       total number of page (Integer)
 * @param {*} location       location information (lat and lon)
 * @param {*} cb             callback function
 */
function getSearchDataByKeyWord(SearchKeyWord, searchFor, pageSize, location, cb) {
  let searchUrl = searchBaseUrl + '/' + databaseName + '/' + searchFor + '/_search';
  let options;
  //need address1 too fro auto suggestion in create event
  let fieldsToFetch = (searchFor === 'venues') ? ['name', 'city', 'state', 'country', 'zip','address_line1'] : ['name'];
  options = {
    method: 'POST',
    uri: searchUrl,
    body: {
      'size': pageSize,
      '_source': fieldsToFetch,
      'query': {
        'bool': {
          'must': [
            {
              'query_string': {
                'query': '*' + _.toLower(SearchKeyWord) + '*',
                'fields': fieldsToFetch,
                'default_operator': 'and'
              }
            },
            {
              'terms': {
                'status': [1, 4]
              }
            }
          ]
        }
      }
    },
    json: true // Automatically stringifies the body to JSON
  };
  if (location && location.lat !== undefined && location.lon !== undefined) {
    options.body.sort = [{
      "_geo_distance" : {
        "location" : {'lat':location.lat, 'lon':location.lon},
        "order" : "asc",
        "unit" : "km"
      }
    }];
  }

  request(options)
    .then((result) => {
      let listArray = result.hits.hits;
      let list = [];
      _.map(listArray, (obj) => {
        if (searchFor === 'venues') {
          list.push({
            'sort': obj.sort && typeof obj.sort === 'object' && obj.sort.length ? obj.sort[0] : null,
            'id': obj._id,
            'value': obj._source.name,
            'city': obj._source.city,
            'state': obj._source.state,
            'country': obj._source.country,
            'address_line1' : obj._source.address_line1,
            'zip': obj._source.zip
          });
        } else {
          list.push({
            'id': obj._id,
            'value': obj._source.name
          });
        }
      });
      cb(null, list);
    })
    .catch((err) => cb(err));

}

/**
 * 
 * @param {*} data {'type': 'event',
                    'ids': ['243234242342234','45645646456456'],
                    }
 * @param {*} cb  callback function
 */
function getFansCountByType(data, cb) {
  let venueIds = [];
  let artistIds = [];
  let eventIds = [];
  let venueCounts = [];
  let artistCounts = [];
  let eventCounts = [];
  let eventsObjs = [];

  promise.try(() => {
    if (data.type === 'event') {
      // Find event count for event ids
      // Get all the eventIds
      return EventsModel.find({
        '_id': {
          '$in': data.ids
        }
      })
        .then((events) => {
          if (events && events.length) {
            eventsObjs = events;
            _.map(events, (eventObj) => {
              eventIds.push(eventObj._id.toString());
              venueIds.push(eventObj.venue.id);
              _.forEach(eventObj.artists, (artist) => {
                artistIds.push(artist.id);
              });
            });
          }
          return;
        });
    }
  })
    .then(() => {
      return promise.try(() => {
        if (data.type === 'venue') {
          return this.getVenueFanCountsAsync(data.ids, false)
            .then((res) => {
              venueCounts = res;
            });
        } else if (data.type === 'artist') {
          return this.getArtistFanCountsAsync(data.ids, false)
            .then((res) => {
              artistCounts = res;
            });
        } else if (data.type === 'event') {
          return this.getVenueFanCountsAsync(venueIds, true)
            .then((resVenueCount) => {
              venueCounts = resVenueCount;
              return this.getArtistFanCountsAsync(artistIds, false)
                .then((resArtistCount) => {
                  artistCounts = resArtistCount;
                  return this.getEventFanCountsAsync(eventIds)
                    .then((resEventCount) => {
                      eventCounts = resEventCount;
                    });
                });
            });
        }
      });
    })
    .then(() => {
      if (data.type === 'venue') {
        cb(null, venueCounts);
      } else if (data.type === 'artist') {
        cb(null, artistCounts);
      } else if (data.type === 'event') {
        let eventRes = [];
        let keyByVenue = _.keyBy(venueCounts, '_id');
        let keyByArtist = _.keyBy(artistCounts, '_id');
        let keyByEvents = _.keyBy(eventCounts, '_id');
        _.forEach(eventsObjs, (eventObj) => {
          let count = 0;
          if (keyByEvents[eventObj._id.toString()]) {
            count = count + keyByEvents[eventObj._id.toString()].count;
            // add  venue count
            if (keyByVenue[eventObj.venue.id]) {
              count = count + keyByVenue[eventObj.venue.id].count;
            }
            _.forEach(eventObj.artists, (artistObj) => {
              if (keyByArtist[artistObj.id]) {
                count = count + keyByArtist[artistObj.id].count;
              }
            });
          }
          eventRes.push({
            _id: eventObj._id,
            count
          });
        });
        cb(null, eventRes);
      }
    })
    .catch((e) => cb(e));
}
/**
 * Function is used to get total count of fans of venues
 * @param {*} venueIds     All venue id's
 * @param {*} isEventCall  Boolean value
 * @param {*} cb           Call back function
 */
function getVenueFanCounts(venueIds, isEventCall, cb) {
  let fanQuery = {
    $and: [{
      venue_id: {
        $in: venueIds
      }
    },
    {
      $or: [{
        status: eventsfyFansStatus.enabled
      }, {
        status: eventsfyFansStatus.flagged
      }]
    }
    ]
  };
  if (isEventCall) {
    fanQuery['$and'].push({
      type: eventsfyFansType.venue
    });
  }
  return EventsfyFanModel.aggregate([{
    $match: fanQuery
  },
  {
    $group: {
      _id: '$venue_id',
      count: {
        $sum: 1
      }
    }
  }
  ])
    .then((res) => {
      return cb(null, res);
    })
    .catch((e) => {
      cb(e)
    });
}

/**
 * Function is used to get total count of fans of an artist
 * @param {*} artistIds    All Artist Id's
 * @param {*} isEventCall  Boolean value
 * @param {*} cb           Call back function
 */
function getArtistFanCounts(artistIds, isEventCall, cb) {
  let fanQuery = {
    $and: [{
      artist_ids: {
        $in: artistIds
      }
    },
    {
      $or: [{
        status: eventsfyFansStatus.enabled
      }, {
        status: eventsfyFansStatus.flagged
      }]
    }
    ]
  };

  if (isEventCall) {
    fanQuery['$and'].push({
      type: eventsfyFansType.artist
    });
  }
  return EventsfyFanModel.aggregate([{
    $match: fanQuery
  }, {
    $unwind: '$artist_ids'
  }, {
    $group: {
      _id: '$artist_ids',
      count: {
        $sum: 1
      }
    }
  }])
    .then((res) => {
      return cb(null, res);
    })
    .catch((e) => cb(e));
}

/**
 * Function is used to get total count of fans of an event
 * @param {*} eventIds  All Event id's
 * @param {*} cb        call back function
 */
function getEventFanCounts(eventIds, cb) {
  let fanQuery = {
    '$and': [{
      event_id: {
        '$in': eventIds
      }
    },
    {
      fans_type: eventsfyFansType.event
    },
    {
      '$or': [{
        status: eventsfyFansStatus.enabled
      }, {
        status: eventsfyFansStatus.flagged
      }]
    }
    ]
  };
  return EventsfyFanModel.aggregate([{
    '$match': fanQuery
  },
  {
    '$group': {
      _id: '$event_id',
      count: {
        $sum: 1
      }
    }
  }
  ])
    .then((res) => {
      return cb(null, res);
    })
    .catch((e) => cb(e));
}

/**
 * Function is used to fetch all the events nearby users location
 * @param {*} pageSize   used for pagination (Integer value)
 * @param {*} pageNumber used for pagination e.g 1,2
 * @param {*} data       required for qurying the results 
 * @param {*} cb         call back function
 */
function getEventsNearLocation(pageSize, pageNumber, data, cb) {
  let pageStartFrom = ((pageNumber - 1) * pageSize);
  let fromDate = dateFormat(new Date().toUTCString(), "yyyy-mm-dd'T'HH:MM:ss");
  let toDate;
  if (data.fromDate) {
    fromDate = dateFormat(new Date(data.fromDate).toUTCString(), "yyyy-mm-dd'T'HH:MM:ss");
  }
  if (data.toDate) {
    toDate = new Date(data.toDate);
    toDate = dateFormat(toDate.toUTCString(), "yyyy-mm-dd'T'HH:MM:ss");
  } else {
    toDate = data.fromDate ? new Date(fromDate) : new Date(); // Today!
    toDate.setDate(toDate.getDate() + 1); // Tomorrow!
    toDate = dateFormat(toDate.toUTCString(), "yyyy-mm-dd'T'HH:MM:ss");
  }

  let radius = (data.radius) ? data.radius + 'mi' : '50mi'; //radius unit is miles. We are attaching unit 'mi' for radius
  let searchUrl = searchBaseUrl + '/' + databaseName + '/events/_search';
  let sortCondition;
  let options;
  // Validate the address cordinates
  promise.try(() => {
    if (data.lat && data.lon) {
      return {
        'lat': data.lat,
        'lon': data.lon
      };
    } else if (data.city || data.state || data.zip) {
      let address = _.values(_.pick(data, ['city', 'state', 'zip'])).join(' ');
      return addressHelper.getCoordinatesGoogleAsync(address,false)
        .then((cordinates) => {
          if (cordinates['lat'] === 0 && cordinates['lon'] === 0) {
            cb(new customError({ 'custom_error': 'badData', 'message': 'Invalid Address.' }));
          }
          return {
            'lat': cordinates['lat'],
            'lon': cordinates['lon']
          };
        });
    } else {
        // if no location found then show US result
        return { 
          'lat': 40.6998433,
          'lon': -74.0072436
        };
      
      }
  })
    .then((venue_location) => {
      if (data.sortBy === 'time') {
        sortCondition = [
          {
            'event_schedule.start_date': {
              'order': 'asc',
              'mode': 'min',
              'nested_path': 'event_schedule',
              'nested_filter': {
                'range': {
                  'event_schedule.start_date': {
                    'gte': fromDate,
                    'lt': toDate
                  }
                }
              }
            }
          },
          {
            'event_schedule.start_hour.keyword': {
              'order': 'asc',
              'mode': 'min',
              'nested_path': 'event_schedule'
            }
          },
          {
            '_geo_distance': {
              'nested_path': 'venue',
              'venue.location': venue_location,
              'order': 'asc',
              'unit': 'mi',
              'distance_type': 'plane'
            }
          }];
      } else if (data.sortBy === 'trending') {
        sortCondition = [{
          "_script": {
                "script": "doc['total_fan_count'].value + doc['click_count'].value",
                "type": "number",
                "order": "desc"
            }
          }
        ];
      } else if (data.sortBy === 'name') {
        sortCondition = [{
          'name.untouched': {
            'order': 'asc'
          }
        }];
      } else {
        sortCondition = [{
          '_geo_distance': {
            'nested_path': 'venue',
            'venue.location': venue_location,
            'order': 'asc',
            'unit': 'mi',
            'distance_type': 'plane'
          }
        },
        {
          'event_schedule.start_date': {
            'order': 'desc',
            'mode': 'min',
            'nested_path': 'event_schedule',
            'nested_filter': {
              'range': {
                'event_schedule.start_date': {
                  'gte': fromDate,
                  'lt': toDate
                }
              }
            }
          }
        },
        {
          'event_schedule.start_hour.keyword': {
            'order': 'asc',
            'mode': 'min',
            'nested_path': 'event_schedule'
          }
        }
        ];
      }
      if (venue_location.lat === 40.6998433 && venue_location.lon === -74.0072436) {
        options = {
          method: 'POST',
          uri: searchUrl,
          body: {
            'size': pageSize,
            'from': pageStartFrom,
            'query': {
              'bool': {
                'filter': [{
                  'nested': {
                    'path': 'event_schedule',
                    'query': {
                      'range': {
                        'event_schedule.start_date': {
                          'gte': fromDate,
                          'lt': toDate
                        }
                      }
                    }
                  }
                },
                {
                  'term': {
                    'status': 1
                  }
                }],
                'should':[]
              }
            },
            'sort': sortCondition
          },
          json: true // Automatically stringifies the body to JSON
        };
      } else {
        options = {
          method: 'POST',
          uri: searchUrl,
          body: {
            'size': pageSize,
            'from': pageStartFrom,
            'query': {
              'bool': {
                'filter': [{
                  'nested': {
                    'path': 'event_schedule',
                    'query': {
                      'range': {
                        'event_schedule.start_date': {
                          'gte': fromDate,
                          'lt': toDate
                        }
                      }
                    }
                  }
                },
                {
                  'term': {
                    'status': 1
                  }
                }],
                'should':[]
              }
            },
            'sort': sortCondition
          },
          json: true // Automatically stringifies the body to JSON
        };
      }

      // If not trending request then apply the filter
      if (!data.isTrending) {
        options['body']['query']['bool']['filter'].push({
          'nested': {
            'path': 'venue',
            'query': {
              'geo_distance': {
                'distance': radius,
                'venue.location': venue_location
              }
            }
          }
        });
      }else if (data.isTrending){
        options['body']['query']['bool']['filter'].push({
          'nested': {
            'path': 'venue',
            'query': {
              'geo_distance': {
                'distance': radius,
                'venue.location': venue_location
              }
            }
          }
        });
        options['body']['query']['bool']['should'].push({
          "script": {
              "script": "doc['click_count'].value > 0"
            }
          
          }
        );
        options['body']['query']['bool']['should'].push({
        "script": {
            "script": "doc['total_fan_count'].value > 0"
          }
        });
      }

      request(options)
        .then((result) => {
          cb(null, result);
        })
        .catch((err) => cb(err));
    })
    .catch((err) => cb(err));
}

/**
 * Function is used to get serch result data baes on the date and location selected by the user
 * @param {*} pageSize       used for pagination (integer)
 * @param {*} pageNumber     used for pagination (Integer)
 * @param {*} isHomePageCall boolean value 
 * @param {*} data           query data
 * @param {*} cb             call back function
 */
function getAdvanceFilterSearchData(pageSize, pageNumber, isHomePageCall, data, cb) {
  let searchFor = 'events,venues,artists';
  if (data['searchKeyWord']) {
    data['searchKeyWord'] = data['searchKeyWord'].replace(/[^A-Z0-9- ]+/ig, '');
    data['searchKeyWord'] = _.trim(data['searchKeyWord']);
  }
  if (data.type) {
    searchFor = data.type === 'city' ? 'events' : data.type;
  }
  let searchUrl = searchBaseUrl + '/' + databaseName + '/' + searchFor + '/_search';
  promise.try(() => {
    // Search location range
    if (data.location && data.location.radius) {
      let address = _.values(_.pick(data.location, ['city', 'state', 'zip'])).join(' ');
      return addressHelper.getCoordinatesGoogleAsync(address,false)
        .then((cordinates) => {
          if (cordinates['lat'] === 0 && cordinates['lon'] === 0) {
            cb(new customError({ 'custom_error': 'badData', 'message': 'Invalid Address.' }));
          } else {
            data.lat = cordinates['lat'];
            data.lon = cordinates['lon'];
          }
        });
    } else if (data.lat && data.lon) {
      data.location = {};
      data.radius = data.radius || 25;
    }
  })
    .then(() => {
      // If category search is for All music then add children
      if (data.categories && data.categories.length && _.includes(data.categories, 'All Music')) {
        return categoriesModel.findOneAsync({ 'url': 'music' })
          .then((musicCategory) => {
            if (musicCategory) {
              return categoriesModel.find({ 'parent_id': musicCategory['id'].toString() })
                .then((dbCategories) => {
                  if (dbCategories && dbCategories.length) {
                    data.categories.push(musicCategory.name);
                    data.categories = _.concat(data.categories, _.map(dbCategories, (category) => category.name));
                  }
                });
            }
          })
      }
    })
    .then(() => {
      let options = {
        method: 'POST',
        uri: searchUrl,
        body: _getAdvanceFilterSearchQuery(pageSize, pageNumber, isHomePageCall, data),
        json: true // Automatically stringifies the body to JSON
      };
      return request(options)
        .then((result) => {
          cb(null, result);
        })
    })
    .catch((err) => cb(err));
}

promise.promisifyAll(module.exports);
