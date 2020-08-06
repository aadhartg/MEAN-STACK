/**
 * Importing all the necessary files
 */
import { Component, OnInit, ViewChild, Inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { environment } from '../../environments/environment';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { HttpParams, HttpClient } from '@angular/common/http';
import { ExploreSearchService } from '../services/explore-search.service';
import { CommonService } from '../services/common.service';
import { VenueProfileService } from '../services/venue-profile.service';
import { Meta, Title } from "@angular/platform-browser";
import { AuthService } from '../services/auth.service';
import * as moment from 'moment';
import * as _ from "lodash";
declare var $: any;
declare var a2a: any;

// Defining template and styles
@Component({
  selector: 'app-search-result',
  templateUrl: './search-result.component.html',
  styleUrls: ['./search-result.component.sass'],
  providers: [ExploreSearchService,VenueProfileService]
})


export class SearchResultComponent implements OnInit, OnDestroy {
  // adding all necessary  variables
  showAddToCalOptions: boolean;
  autocomplete: google.maps.places.Autocomplete;
  imageUrl: string = environment.imageUrl;
  body = {};
  category: string;
  type: string = "events";
  city: string = "";
  state: string = "";
  zip: string = "";
  radius:number;
  fromDate: string = "";
  showAll: string = "";
  loading: boolean = false;
  token;
  showArtistMoreButton: Boolean = false;
  showEventMoreButton: Boolean = false;
  showVenueMoreButton: Boolean = false;
  showLocationMoreButton: Boolean = false;
  currentUser: any;
  pageNumber: any= 0;
  artistPageNumber: any= 0;
  venuePageNumber: any= 0;
  locationPageNumber: any= 0;
  suggestionList = [];
  venueList: any = [];
  eventList: any = [];
  artistList: any = [];
  locationList: any = [];
  eventMinPagesize = 4;
  artistMinPagesize = 4;
  venueMinPagesize = 4;
  locationMinPagesize = 4;
  currentPageNo = 1;
  pageList = [];
  paginationLimit = 10;
  totalPages = 0;
  eventPageno = 1;
  totalRecords: any = {};
  noResultFound = false;
  eventTotalPages:any;
  eventMaxPageSize = 20;
  artistTotalPages:any;
  artistMaxPageSize = 20;
  venueTotalPages;
  venueMaxPageSize = 20;
  locationTotalPages;
  locationMaxPageSize = 20;
  artistPageno = 1;
  venuePageno = 1;
  locationPageno = 1;
  modalData: any = {};
  modal_value: any = {};
  sortByText = "";
  showEvents = true;
  showArtists = true;
  showVenues = true;
  showLocations = true;
  showPagination = false;
  isResult = false;
  showMapView = false;
  showMapAutocompleteInput = false;
  exploreMapEvents: any = [{}];
  enable_pop_up_get_tickets = false;
  enable_pop_up_more_info = false;
  alertType;
  address: any;
  urlString: any;
  urlString1: any;
  urlString2: any;
  urlString3: any;
  userDetectedLocation: any;
  showCircle = false;
  markerList = false;
  styles: any = {}
  zoom: 7;
  mapData = "";
  maprefresh=false;
  showCirlce = false;
  center: string = "";
  mapMarkers = [];
  exploreEvents: any = [{}];
  mapinstance:any;
  artistProfileUrl: string="";


  constructor(
    private actRoute: ActivatedRoute,
    private router: Router,
    private exploreSearchService: ExploreSearchService,
    private commonService: CommonService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private venueProfileService: VenueProfileService,
    meta: Meta, title: Title,
    private ref: ChangeDetectorRef,
    private authService: AuthService
  ) {
    title.setTitle('Upcoming Events');
    meta.updateTag({ name: 'keywords', content: 'eventsy search, find, events for you, events near by you, todays events' })
    meta.updateTag({ name: 'description', content: 'Experience the Arts Near You, Today!' });
  }

  //initializing the app
  initialized(autocomplete: any) {
    this.autocomplete = autocomplete;
  }
  
  // getting url sting
  getCleanUrl(urlString, index) {
    let urlArray = urlString.split('/');
    return urlArray[index];
  }

  // function is used to detect if the place of the user is  changed
  placeChanged(place) {
    this.center = place.geometry.location;
    this.address = [];
    for (let i = 0; i < place.address_components.length; i++) {
      let addressType = place.address_components[i].types[0];
      //for state take short_name
      if (addressType == 'administrative_area_level_1') {
        this.address[addressType] = place.address_components[i].short_name;
      } else {
        this.address[addressType] = place.address_components[i].long_name;
      }
    }

    this.body['city'] = this.address['locality'];
    this.body['state'] = this.address['administrative_area_level_1'];
    this.body['lat'] = place.geometry.location.lat() || undefined;
    this.body['lon'] = place.geometry.location.lng() || undefined;
    this.body['zip'] = this.address['postal_code'] || undefined;
    if (typeof this.currentUser.search_location_range == "string") {
      this.radius = parseInt(this.currentUser.search_location_range);
    }
    this.body['radius'] = this.radius;

    this.ref.detach();
    this.loading = true;
    setTimeout(function () {
      this.loading = false;
    }, 1000);
    this.getAllEvents(0);
    setInterval(() => {
      this.ref.detectChanges();
    }, 5000);
  }

  // I fthe map radious chnage then get all nesesory data
  onRadiusChange() {
    this.body['city']    = this.city || undefined;
    this.body['state']   = this.state || undefined;
    this.body['zip']     = this.zip || undefined;
    if (typeof this.currentUser.search_location_range == "string") {
      this.radius = parseInt(this.currentUser.search_location_range);
    }
    
    this.body['radius'] = this.radius;
    this.getAllEvents(0);
    if (!this.radius || this.radius == 0) {
      //converting metres to miles
      this.radius = 25 * 1609;
    } else {
      if (this.radius <= 50)
        this.radius = this.radius * 1609;
    }    
     this.showCirlce = true;
    
    
    if (!this.radius || this.radius == 0) {
      //converting metres to miles
      this.radius = 25 * 1609;
    } else {
      if (this.radius <= 50)
        this.radius = this.radius * 1609;
    }
  }

  ngOnInit() {
    // Get current user location
    this.authService.getCurrentLocation(isPlatformBrowser(this.platformId))
      .subscribe((res) => {
        this.userDetectedLocation = res;
        this.initializeData();
      }, (error) => {
        this.initializeData();
      });
     
      this.styles = [
        { elementType: 'geometry', stylers: [{ color: '#f7f7f7' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#f7f7f7' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
        {
          featureType: 'administrative.locality',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#a2a2a2' }]
        },
        {
          featureType: 'poi',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#a2a2a2' }]
        },
        {
          featureType: 'poi.park',
          elementType: 'geometry',
          stylers: [{ color: '#e5e5e5' }]
        },
        {
          featureType: 'poi.park',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#a2a2a2' }]
        },
        {
          featureType: 'road',
          elementType: 'geometry',
          stylers: [{ color: '#ffffff' }]
        },
        {
          featureType: 'road',
          elementType: 'geometry.stroke',
          stylers: [{ color: '#ffffff' }]
        },
        {
          featureType: 'road',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#a2a2a2' }]
        },
        {
          featureType: 'road.highway',
          elementType: 'geometry',
          stylers: [{ color: '#ffffff' }]
        },
        {
          featureType: 'road.highway',
          elementType: 'geometry.stroke',
          stylers: [{ color: '#ffffff' }]
        },
        {
          featureType: 'road.highway',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#a2a2a2' }]
        },        
        {
          featureType: 'transit.station',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#a2a2a2' }]
        },
        {
          featureType: 'water',
          elementType: 'geometry',
          stylers: [{ color: '#99CCFF' }]
        },
        {
          featureType: 'water',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#a2a2a2' }]
        },
        {
          featureType: 'water',
          elementType: 'labels.text.stroke',
          stylers: [{ color: '#a2a2a2' }]
        }
      ];
       setTimeout(function(){
       var element = document.getElementById("searchKeyWord");
       var element2 = document.getElementById("searchKeyWord2");
       if(element && element2){
         element.classList.add("srstyle");
         element2.classList.add("srstyle");
       }
      },2000)
  }

  // function to open promoted event form
  openPromoteEventForm(a,b,c, d) {
    this.router.navigate(['/event', a, b, c, d], { queryParams: { "modalType": a + "/" + b + "/" + c + "/" + d, "typeId": 'paymentModal' } });
  }

  displayMap(){
    // updated code to show the MAP @amit
    var self = this;
    this.showCircle = true;
   
    if(this.eventList) {
        this.eventList.forEach(element => {
          if(element._source.venue.location){
            this.markerList = true;
            element.mapData = element._source.venue;
            element.mapData.eventName = element._source.name;     
            element.location = [parseFloat(element._source.venue.location.lat), parseFloat(element._source.venue.location.lon)];
          }
      });
    }
    
    if (!this.radius || this.radius == 0) {
      //metres to miles
      this.radius = 25 * 1609;
    } else {
      if (this.radius <= 50)
        this.radius = this.radius * 1609;
    }    
     this.showCirlce = true;
    
    
    if (!this.radius || this.radius == 0) {
      //metres to miles
      this.radius = 25 * 1609;
    } else {
      if (this.radius <= 50)
        this.radius = this.radius * 1609;
    }
    //Map slider
    var self = this;
    if (this.center == '' || this.center == undefined) {
      this.center = "United States";
    }
    if (isPlatformBrowser(self.platformId)) {
      $(".autocomplete-input").val(this.center);
      $(".autocomplete-input").show(2000);
    }
    var rangeSlider = function () {
      if (isPlatformBrowser(self.platformId)) {
        var slider = $('.range-slider'),
          range = $('.range-slider__range'),
          max_value = $('.meters');
      }
      slider.each(function () {

        max_value.each(function () {
          if (isPlatformBrowser(self.platformId)) {
            var max_value = $(this).prev().attr('value');
            $(this).html(max_value);
          }
        });

        range.on('input', function () {
          let radius1 = parseInt(this.value);
          self.radius = parseInt(this.value) * 1609;
          if (isPlatformBrowser(self.platformId)) {
            $('.meters').html(this.value + ' m');
          }
        });
      });
    };
    rangeSlider();
    if (this.eventList) {
      this.eventList.forEach(element => {
        if(element._source.venue.location){
          self.markerList = true;
          element.mapData = element._source.venue;
          element.mapData.eventName = element._source.name;
          element.location = [parseFloat(element._source.venue.location.lat), parseFloat(element._source.venue.location.lon)];
        }
      });
    }
  }

  initializeData() {
    
    this.token = this.commonService.isLoggedIn();
    if (this.userDetectedLocation && this.userDetectedLocation.country_code === 'US') {
      this.city = this.userDetectedLocation.city;
      this.state = this.userDetectedLocation.region_code;
      this.zip = this.userDetectedLocation.zip_code;
      if (this.token) {
        this.currentUser = JSON.parse(this.commonService.getItem('currentUser'));
        if (this.currentUser.search_location_range) {
          this.body['radius'] = this.currentUser.search_location_range;
        }
      }
      this.body['lat'] = this.userDetectedLocation.latitude;
      this.body['lon'] = this.userDetectedLocation.longitude;
      this.body['city'] = this.city + " ";
    } else if (this.token) {
      this.currentUser = JSON.parse(this.commonService.getItem('currentUser'));
      let userLocation = '';
      if (this.currentUser.city) {
        userLocation += this.currentUser.city + " ";
      }
      if (this.currentUser.state) {
        userLocation += this.currentUser.state + " ";
      }
      this.currentUser.location = userLocation;
      if (this.currentUser.city) {
        this.body['city'] = this.currentUser.city;
      } else if (this.currentUser.state) {
        this.body['state'] = this.currentUser.state;
      } else if (this.currentUser.zip) {
        this.body['zip'] = this.currentUser.zip;
      }
      if (this.currentUser.search_location_range) {
        this.body['radius'] = this.currentUser.search_location_range;
      }
    } else {
      this.currentUser = {};
      this.currentUser.location = "US";
    }
    //More Info and Get Ticket values are not getting updated so commented out
    //this.isAuthenticationRequired();
    this.eventMinPagesize = 4;
    this.artistMinPagesize = 4;
    this.venueMinPagesize = 4;
    this.locationMinPagesize = 4;

    this.actRoute.queryParams.subscribe(params => {
      this.body = Object.assign({}, params);
      this.body['categories'] = params['category'] && typeof params['category'] === 'string' ? params['category'].split('_') : params['category'];

      if (typeof this.body['categories'] == "string") {
        this.body['categories'] = [];
        this.body['categories'].push(params['category'])
      }

      if (params['fromDate']) {
        this.body['fromDate'] = params['fromDate'];
      }

      this.body['pageSize'] = 4;
      this.body['pageNumber'] = 1;
      this.loading = true;

      this.actRoute.queryParams.subscribe(params => {
        this.loading = true;
        this.getEventArtistVenueLocationList(this.body);
      })
    });
  }

  progressEvent(ticketlink, eventId) {
    this.commonService.progressEvent(ticketlink, eventId)
      .subscribe(() => {
      },
      (err) => {
      })
  }

  getEventArtistVenueLocationList(body) {
    let self = this;

    if (body.type == 'All') {
      this.showPagination = false;
      this.showLocations = true;
      this.showEvents = true;
      this.showArtists = true;
      this.showVenues = true;
      setTimeout(function () {
        /**
         * body: this.body using params
         * pageSize: no. of records to show
         * pageNo: current page no
         * showEventsOnly: `true` when show all events get clicked else default `false`
         */
        self.getEventList(body, self.eventMinPagesize, self.eventPageno, false);
      }, 100)
      setTimeout(function () {
        self.getArtistList(body, self.artistMinPagesize, self.artistPageno, false);
      }, 120)
      setTimeout(function () {
        self.getVenueList(body, self.venueMinPagesize, self.venuePageno, false);
      }, 140)
      setTimeout(function () {
        self.getLocationList(body, self.locationMinPagesize, self.locationPageno, false);
      }, 160)
    } else if ( body.type == 'Events') {
      self.getAllEvents(0)
    } else if ( body.type == 'Artists') {
      self.getAllArtists(0)
    } else if ( body.type == 'Venues') {
      self.getAllVenues(0)
    } else if ( body.type == 'city') {
      self.getAllLocations(0)
    }

  }

  getAllEvents(val) {
    if(val == 0)
      this.pageNumber = 0;
    this.body['type'] = "events";
    this.body['sortBy'] = "time";
    this.sortByText = "TIME";
    this.pageNumber = this.pageNumber+1;
    this.getEventList(this.body, this.eventMaxPageSize, this.pageNumber, true);
  }
  getAllVenues(val) {
    if(val == 0)
      this.venuePageNumber = 0;
    this.body['type'] = "venues";
    this.body['sortBy'] = "name";
    this.sortByText = "NAME";
    this.venuePageNumber = this.venuePageNumber+1;
    this.getVenueList(this.body, this.venueMaxPageSize, this.venuePageNumber, true);
  }
  getAllArtists(val) {
    if(val == 0)
      this.artistPageNumber = 0;
    this.body['type'] = "artists";
    this.body['sortBy'] = "name";
    this.sortByText = "NAME";
    this.artistPageNumber = this.artistPageNumber+1;
    this.getArtistList(this.body, this.artistMaxPageSize, this.artistPageNumber, true);
  }
  getAllLocations(val) {
    if(val == 0)
      this.locationPageNumber = 0;
    this.body['type'] = "city";
    this.locationPageNumber = this.locationPageNumber+1;
    this.getLocationList(this.body, this.locationMaxPageSize, this.locationPageNumber, true);
  }

  getEventList(body, pageSize, pageNo, showEventsOnly) {
    this.paginationLimit = 10;
    let bodyParams = Object.assign({}, body);
    bodyParams['type'] = "events";
    bodyParams['pageSize'] = pageSize;
    bodyParams['pageNumber'] = pageNo;
    this.currentPageNo = pageNo;
    this.loading = true;
    this.exploreSearchService.getEventArtistVenueLocation(bodyParams)
      .subscribe((eventRes) => {
        this.eventTotalPages = eventRes.data.hits.total;
    
        this.loading = false;
        
        if(pageNo == 1)
        {
          this.eventList = eventRes.data.hits.hits ; 
        }
        else
        {
          this.eventList.push(...eventRes.data.hits.hits);
        }
       
        if(this.eventTotalPages> this.eventList.length)
        {
          this.showEventMoreButton = true;
        }
        else{
          this.showEventMoreButton = false;
        }
        this.eventList.forEach((event, index) => {
          if (event._source) {
            this.isResult = true;
            event._source._id = event._id;
            event._source.imageUrl = this.imageUrl + this.commonService.returnHeroImageFromCategory(event._source.categories, 'event', 'small');
            event._source.images.forEach((image) => {
              if (image) {
                if (image.is_hero_image == true && image.cdn_thumb_url != "") {
                  event._source.imageUrl = image.cdn_thumb_url;
                } else if (image.is_hero_image == true && image.thumb_url != "") {
                  event._source.imageUrl = image.thumb_url;
                } else if (image.is_hero_image == true && image.url != "") {
                  event._source.imageUrl = image.url;
                }
              }
              return;
            });
          }
          if (showEventsOnly == true) {
            this.showPagination = true;
            this.showEvents = true;
            this.showArtists = false;
            this.showVenues = false;
            this.showLocations = false;
          }
        });
         
        if (this.showMapView) {
          //if true make it false to switch to map view
          this.getMapData();
        }
      },
      (err) => {
        this.loading = false;
        this.eventList = [];
      })
  }

  getArtistList(body, pageSize, pageNo, showArtistsOnly) {
    // this.artistList = [];
    this.paginationLimit = 10;
    this.loading = true;
    let bodyParams = Object.assign({}, body);
    bodyParams['type'] = "artists";
    bodyParams['pageSize'] = pageSize;
    bodyParams['pageNumber'] = pageNo;
    this.currentPageNo = pageNo;
    this.exploreSearchService.getEventArtistVenueLocation(bodyParams)
      .subscribe((artistRes) => {
        this.isResult = true;
        this.loading = false;
        this.artistTotalPages = artistRes.data.hits.total;
     
        if(pageNo == 1)
        {
          this.artistList = artistRes.data.hits.hits;
        }
        else
        {
          this.artistList.push(...artistRes.data.hits.hits);
        }
        if(this.artistTotalPages> this.artistList.length)
        {
          this.showArtistMoreButton = true;
        }
        else{
          this.showArtistMoreButton = false;
        }
        this.artistList.forEach((artist, index) => {
          if (artist._source) {
            artist._source._id = artist._id;
            artist._source.imageUrl = this.imageUrl + '/website/assets/images/artist_default_400.jpg';
            artist._source.images.forEach((image) => {
              if (image) {
                if (image.is_hero_image == true && image.cdn_thumb_url != "") {
                  artist._source.imageUrl = image.cdn_thumb_url;
                } else if (image.is_hero_image == true && image.thumb_url != "") {
                  artist._source.imageUrl = image.thumb_url;
                } else if (image.is_hero_image == true && image.url != "") {
                  artist._source.imageUrl = image.url;
                }
              }
              return;
            });
          }
          if (showArtistsOnly == true) {
            this.showPagination = true;
            this.showArtists = true;
            this.showEvents = false;
            this.showVenues = false;
            this.showLocations = false;
          }
        });
      },
      (err) => {
        this.loading = false;
        this.artistList = [];
      })
  }

  showAllEventsFromCity(city) {
    let params = new HttpParams();
    params = params.append('city', city);

    this.body['city'] = city;
    this.body['type'] = "events";
    this.router.navigate(['/explore-event'], { queryParams: { "searchKeyWord": this.body['searchKeyWord'], "city": this.body['city'],'isCity':true, "fromDate": this.body['fromDate'], "category": this.body['category'] } })

    //this.getEventList(this.body, this.eventMaxPageSize, 1, true);
  }

  getVenueList(body, pageSize, pageNo, showVenuesOnly) {
    // this.venueList = [];
    this.paginationLimit = 10;
    this.loading = true;
    let bodyParams = Object.assign({}, body);
    bodyParams['type'] = "venues";
    bodyParams['pageSize'] = pageSize;
    bodyParams['pageNumber'] = pageNo;
    this.currentPageNo = pageNo;
    this.exploreSearchService.getEventArtistVenueLocation(bodyParams)
      .subscribe((venueRes) => {
        this.isResult = true;
        this.loading = false;
        this.venueTotalPages = venueRes.data.hits.total;
    
        if(pageNo == 1)
        {
          this.venueList = venueRes.data.hits.hits;
        }
        else
        {
          this.venueList.push(...venueRes.data.hits.hits);
        }
        if(this.venueTotalPages> this.venueList.length)
        {
          this.showVenueMoreButton = true;
        }
        else{
          this.showVenueMoreButton = false;
        }

        this.venueList.forEach((venue, index) => {
          if (venue._source) {
            venue._source._id = venue._id;
            venue._source.imageUrl = this.imageUrl + '/website/assets/images/venue_default_400.jpg';
            venue._source.images.forEach((image) => {
              if (image) {
                if (image.is_hero_image == true && image.cdn_thumb_url != "") {
                  venue._source.imageUrl = image.cdn_thumb_url;
                } else if (image.is_hero_image == true && image.thumb_url != "") {
                  venue._source.imageUrl = image.thumb_url;
                } else if (image.is_hero_image == true && image.url != "") {
                  venue._source.imageUrl = image.url;
                }
              }
              return;
            });
          }
          if (showVenuesOnly == true) {
            this.showPagination = true;
            this.showVenues = true;
            this.showEvents = false;
            this.showArtists = false;
            this.showLocations = false;
          }
        });
      },
      (err) => {
        this.loading = false;
        this.venueList = [];
      })
  }

  getLocationList(body, pageSize, pageNo, showLocationsOnly) {
    // this.locationList = [];
    this.paginationLimit = 10;
    let bodyParams = Object.assign({}, body);
    bodyParams['type'] = "city";
    this.loading = true;
    bodyParams['pageSize'] = pageSize;
    bodyParams['pageNumber'] = pageNo;
    this.currentPageNo = pageNo;
    this.exploreSearchService.getEventArtistVenueLocation(bodyParams)
      .subscribe((locationRes) => {
        this.isResult = true;
        this.loading = false;
        if (!locationRes.data && !locationRes.data.aggregations) {
          this.locationList = [];
          return false;
        }
        this.locationTotalPages = locationRes.data.aggregations.event_venuecity_aggregation.buckets.buckets.length;

        let locationArray = locationRes.data.aggregations.event_venuecity_aggregation.buckets.buckets;
        if (!showLocationsOnly) {
          this.locationList = locationArray.slice(0, 4);
        } else if(pageNo == 1){
          this.locationList= locationRes.data.aggregations.event_venuecity_aggregation.buckets.buckets ;

        }
        else{
          this.locationList.push(...locationRes.data.aggregations.event_venuecity_aggregation.buckets.buckets);
        }
        if(this.locationTotalPages> this.locationList.length)
        {
          this.showLocationMoreButton = true;
        }
        else{
          this.showLocationMoreButton = false;
        }

        if (showLocationsOnly == true) {
          this.showPagination = true;
          this.showLocations = true;
          this.showEvents = false;
          this.showArtists = false;
          this.showVenues = false;
        }
      },
      (err) => {
        this.loading = false;
        this.locationList = [];
      })
  }

  sortBy(tag, sortByTag) {
    this.sortByText = tag;
    this.body['sortBy'] = sortByTag;
    let type = this.body['type'];
    if (type == 'events') {
      this.getEventList(this.body, this.eventMaxPageSize, this.currentPageNo, true);
    } else if (type == 'artists') {
      this.getArtistList(this.body, this.artistMaxPageSize, this.currentPageNo, true);
    } else if (type == 'venues') {
      this.getVenueList(this.body, this.venueMaxPageSize, this.currentPageNo, true);
    } else if (type == 'locations') {
      this.getLocationList(this.body, this.locationMaxPageSize, this.currentPageNo, true);
    }
  }

  getPageData(number, type) {
    this.loading = true;
    this.currentPageNo = number;
    if (type == 'event') {
      this.getEventList(this.body, this.eventMaxPageSize, this.currentPageNo, true);
    } else if (type == 'artist') {
      this.getArtistList(this.body, this.artistMaxPageSize, this.currentPageNo, true);
    } else if (type == 'venue') {
      this.getVenueList(this.body, this.venueMaxPageSize, this.currentPageNo, true);
    } else if (type == 'location') {
      this.getLocationList(this.body, this.locationMaxPageSize, this.currentPageNo, true);
    }
  }

  prevPage(number, type) {
    if (this.totalPages > 0 && this.totalPages >= number) {
      if (this.currentPageNo <= (number + 1)) {
        this.pageList = [];
        this.currentPageNo = number;
        this.getPageData(number, type);
        let counter = 1;
        while (counter <= this.paginationLimit) {
          this.pageList[counter - 1] = number;
          ++number;
          ++counter;
        }
      } else {
        --this.currentPageNo;
        this.getPageData(this.currentPageNo, type);
      }
    }
  }

  nextPage(number, type) {
    if (this.totalPages > 0 && this.totalPages >= number) {
      if (this.currentPageNo >= (number - 1)) {
        this.pageList = [];
        this.currentPageNo = number;
        this.getPageData(number, type);
        let counter = 10;
        while (counter > 0) {
          this.pageList[counter - 1] = number;
          --number;
          --counter;
        }
      } else {
        ++this.currentPageNo;
        this.getPageData(this.currentPageNo, type);
      }
    }
  }
  splitEventUrl(urlString) {
    let urlArray = urlString.split('/');
    this.modalData.urlString = urlArray[0];
    this.modalData.urlString1 = urlArray[1];
    this.modalData.urlString2 = urlArray[2];
    this.modalData.urlString3 = urlArray[3];
  }

  receiveMessage($event) {
    this.modalData = $event;
  }
  setFinalTicketLinks(dataArray) {
    dataArray.forEach((schedule) => {
      schedule.finalTktLinks = [];
      schedule.finalTktLinks = this.commonService.setFinalTicketLinks(schedule);
    });
  }

  //Bind data to modal

  openArtistModal(artist, modalId) {
    this.modalData = Object.assign({},artist);
    this.artistProfileUrl = artist.url;
    if (this.modalData) {
      if(this.modalData.description.length){
        let description ="";
        this.modalData.description.forEach((d)=>{
          description +=d.replace(/<\/?[^>]+(>|$)/g, "")+ " ";
        });
        this.modalData.description = description;
      }

      if(this.modalData.url.indexOf('http')<0){
        this.modalData.url = location.protocol + '//' + location.host +'/event/'+this.modalData.url;
      }

      this.modalData.artistImageUrl = this.imageUrl + '/website/assets/images/artist_default_400.jpg';
      if (this.modalData.images) {
        let images = this.modalData.images;
        images.forEach((image) => {
          if (image.is_hero_image == true && image.url != "" && image.url.indexOf('www.eventsfy.com')<0) {
            this.modalData.artistImageUrl = image.url;
          }
          return;
        });
      }

    }
    setTimeout(function () {
      a2a.init('page');
    }, 500)
    if (isPlatformBrowser(this.platformId)) {
      if (this.enable_pop_up_get_tickets || this.enable_pop_up_more_info) {
        if (!this.commonService.getItem('loginModalOpen')) {
          $("#" + modalId).modal();
        }
      } else {
        if (!this.commonService.getItem('loginModalOpen')) {
          $("#" + modalId).modal();
        }
      }
    }
  }
  openVenueModal(venue, modalId) {
    let imgFlag = 0 //flag to check if hero_image not set then set the first image for background of venue card.
    this.modalData = venue;
    if (this.modalData) {
      if(this.modalData.description){
          this.modalData.description =this.modalData.description.replace(/<\/?[^>]+(>|$)/g, "")+ " ";
        }
      this.modalData.venueImageUrl = this.imageUrl + '/website/assets/images/venue_default_400.jpg';
      if (this.modalData.images) {
        let images = this.modalData.images;
        images.forEach((image) => {
          if (image.is_hero_image == true && image.url != "" && image.url.indexOf('www.eventsfy.com')<0) {
            this.modalData.venueImageUrl = image.url;
            imgFlag++;
          }
          return;
        });
        if(imgFlag==0 && images.length && images[0].url.indexOf('www.eventsfy.com')<0){
          this.modalData.venueImageUrl = images[0].url;
        }
      }
    }
    setTimeout(function () {
      a2a.init('page');
    }, 500)
    if (isPlatformBrowser(this.platformId)) {
      if (this.enable_pop_up_get_tickets || this.enable_pop_up_more_info) {
        if (!this.commonService.getItem('loginModalOpen')) {
          $("#" + modalId).modal();
        }
      } else {
        if (!this.commonService.getItem('loginModalOpen')) {
          $("#" + modalId).modal();
        }
      }
    }
  }
  getUrl_google(schedule, index) {
    let url = this.commonService.getUrl_google(schedule, index);
    return url;
  }

  getUrl_yahoo(schedule, index) {
    let url = this.commonService.getUrl_yahoo(schedule, index);
    return url;
  }

  ics_gen1(schedule) {
    var uri = this.commonService.ics_gen1(schedule);
    if (isPlatformBrowser(this.platformId)) {
      $("#outlook_ics").attr('href', uri);
      $("#outlook_ics1").attr('href', uri);
      this.showAddToCalOptions=false;
    }

  }

  addFansCount(type, id) {
    let body = {};
    this.commonService.setItem('loginModalOpen', true);
    this.loading = true;
    this.token = this.commonService.isLoggedIn();
    if (this.token) {
      this.currentUser = JSON.parse(this.commonService.getItem('currentUser'));
    } else {
      this.currentUser = {};
    }

    if (this.currentUser) {
      body = {
        "type": type,
        "id": id,
        "data": {
          "isLike": true,
          "userId": this.currentUser._id,
          "username": this.currentUser.userName
        }
      }
    }

    this.commonService.addFansCount(body)
      .subscribe((fanRes) => {
        this.alertType = "success-at-top";
        this.loading = false;
        this.commonService.removeItem('loginModalOpen');
        this.modalData.total_fan_count = fanRes.data.total_fan_count;
        this.modalData.resMsg = fanRes.message;
        setTimeout(() => {
          this.modalData.resMsg = undefined;
        }, 4000);
      },
      (err) => {
        this.alertType = "error-at-top";
        this.loading = false
        this.commonService.removeItem('loginModalOpen');
        let errorObj = this.commonService.errorMessage(err);
        this.modalData.resMsg = errorObj['message'];
        setTimeout(() => {
          this.modalData.resMsg = undefined;
        }, 4000);
      })
  }

  //Get Local Data from event data schedule

  getLocalDate(date) {
    var dateFormat = 'MMM DD';
    var testDateUtc: any = moment(date).format(dateFormat);
    return testDateUtc + " - ";
  }

  //Get Local Time from event data schedule

  getLocalTime(time) {
    if (!time) {
      return " ";
    }
    var dateFormat = 'hh:mm a';
    var testDateUtc = moment.utc(time, dateFormat);
    var localDate = testDateUtc.local(true);
    var testDateUtc1 = localDate.format('LT');
    return testDateUtc1 ;
  }

  switchMapView() {
    if (!this.showMapView) {
      return;
    }
    this.showMapView = false;
  }

  getMapData() {
    let self = this;
    self.showMapView = true;
    setTimeout(function () {
      self.showMapAutocompleteInput = true;
      if (isPlatformBrowser(self.platformId)) {
        if ((self.body['city'] || self.body['city'] != '') && $("#places").val() == '') {
          $("#places").val(self.body['city']);
        }
      }
    }, 100)

    this.exploreMapEvents = this.eventList;
    this.exploreMapEvents.forEach((event, index) => {
      if (event._source) {
        this.exploreMapEvents[index].eventImageUrl = this.imageUrl + this.commonService.returnHeroImageFromCategory(event._source.categories, 'event', 'small');
        if (event._source.images) {
          let images = event._source.images;
          images.forEach((image) => {
            if (image.is_hero_image == true && image.url != "") {
              this.exploreMapEvents[index].eventImageUrl = image.url;
            }
            return;
          });

        }
        if (event._source.event_schedule) {
          event._source.event_schedule.forEach((schedule, i) => {
            let eventStartDate = this.getLocalDate(schedule.start_date)
            this.exploreMapEvents[index].eventStartDate = eventStartDate;
            let eventStartTime = this.getLocalTime(schedule.start_hour)
            this.exploreMapEvents[index].eventStartTimeDate =  eventStartDate + eventStartTime ;
          });
        }

      }
    });
    this.displayMap();
  }

  isAuthenticationRequired(): any {
    if (this.commonService.hasItem('enable_pop_up_get_tickets')) {
      this.enable_pop_up_get_tickets = JSON.parse(this.commonService.getItem('enable_pop_up_get_tickets'));
    }
    if (this.commonService.hasItem('enable_pop_up_more_info')) {
      this.enable_pop_up_more_info = JSON.parse(this.commonService.getItem('enable_pop_up_more_info'));
    }
  }

  ngOnDestroy() {
    this.ref.detach();
  }
  closeAddToCalOptions(){
    this.showAddToCalOptions=false;
  }
   onMapReady(map) {
    this.mapinstance = map;
  }
  
  refreshMap() {
    this.maprefresh = true;
    this.center = this.center;
   
  }
  onMarkerInit(marker) {    
  }

  mouseHover(data){ 
  
  this.mapinstance.markers.forEach((element,key) => {
    if(data.venue.location){

      if(Number(data.venue.location.lat.toFixed(7)) == Number(this.mapinstance.markers[key].getPosition().lat().toFixed(7)) && Number(data.venue.location.lon.toFixed(7)) == Number(this.mapinstance.markers[key].getPosition().lng().toFixed(7))){
        this.mapinstance.markers[key].setAnimation(google.maps.Animation.BOUNCE)
        var center = new google.maps.LatLng(this.mapinstance.markers[key].getPosition().lat(), this.mapinstance.markers[key].getPosition().lng());
        
        google.maps.event.trigger(this.mapinstance.markers[key], 'click');
      }else{
        this.mapinstance.markers[key].setAnimation('');
      }
    }
  })
 
  }
  clicked(event, infoObj) {
    this.mapData = "";
    if (!infoObj.name) {
      this.mapData = infoObj;
      let marker = event.target;
      if (marker) {
        marker.ng2MapComponent.openInfoWindow('iw', marker, {
          markerData: this.mapData
        });
      }
    } else {
      if (infoObj.eventName) {
        this.mapData += "<b>Event: </b>" + infoObj.eventName + " , <br/>";
      }
      if (infoObj.name) {
        this.mapData += "<b>Venue: </b>" + infoObj.name + " <br/> ";
      }
      if (infoObj.city) {
        this.mapData += "<b>City: </b>" + infoObj.city + " , ";
      }
      if (infoObj.state) {
        this.mapData += "<b>State: </b>" + infoObj.state + " , ";
      }
      if (infoObj.zip) {
        this.mapData += "<b>Zip: </b>" + infoObj.zip + " ";
      }

      let marker = event.target;
      if (marker) {
        marker.ng2MapComponent.openInfoWindow('iw1', marker, {
          markerData: this.mapData
        });
      }
    }
  }
  getProviderName(provider_id){
    return this.commonService.getProviderName(provider_id);
  }
}
