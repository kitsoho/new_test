var map;
var w =640;
var h=620;
var layers = {};
var geocoder;
var polygons;
var countiesGeometries;
var thesettings = {};
var sql = new cartodb.SQL({
    user: 'spatial',
    format: 'geojson'
});

var sqljson = new cartodb.SQL({
    user: 'spatial',
    format: 'json'
});
   var svgchart;

//options for the county outline
var googleOptions = {
    fillOpacity: 0,
    strokeColor: "black",
    strokeWeight: 3,
    strokeOpacity: 0.75,
    draggable: true

};

// this is the quartile category for the foreign born
//          q R
// 1 0.70-0.75 6
// 2 0.75-0.80 5
// 3 0.80-0.85 4
// 4 0.85-0.90 3
// 5 0.90-0.95 2
// 6 0.95-1.00 1
// 99 is everything else so 100 includes all since we're using <

thesettings.qcat = 100;

// set the initial field to use for showing the tract points
thesettings.eth = '_foreign';
thesettings.ethd3 = '_foreign';

// the bounds of a county for zooming to
thesettings.countybounds;

// the distance in tract distance limit

thesettings.TRdist;

// the people in distance limits

thesettings.TRpeople;

//county data for chart

thesettings.cntydata;


//*********************************************************************
// ----- Initial CartoDB Settings
//*********************************************************************

// set the cartoCSS for the tract centroids
var TRPTcartoCSS;
cngTRPTCartoCSS(thesettings.eth, 0.5, 'darken')



// set the cartoCSS for the tract polygons
var TRcartoCSS;
cngTRCartoCSS(thesettings.eth, 0.75, 'darken')

// set the cartoCSS for the cities
var citycartoCSS = "#{{table_name}}{ \
  marker-fill: #333333; \
  marker-opacity: 0.9; \
  marker-allow-overlap: true; \
  marker-placement: point; \
  marker-type: ellipse; \
  marker-width: 6; \
  marker-line-width: 1; \
  marker-line-color: #FFF; \
  marker-line-opacity: 0.9; \
}"



var countycartoCSS = "#nyscnty{ \
  polygon-fill: #FFFFFF; \
  polygon-opacity: 0.5; \
  line-width: 1; \
  line-color: #CCCCCC; \
  line-opacity: 1; \
} \
#nyscnty::labels[zoom>=9] { \
  text-name: [name]; \
  text-face-name: 'DejaVu Sans Book'; \
  text-size: 16; \
  text-fill: green; \
  text-allow-overlap: true; \
  text-halo-fill: #FFF; \
  text-halo-radius: 3; \
  text-dy: 0; \
}"


//*********************************************************************
// ----- Document Ready
//*********************************************************************

$(document).ready(function() {

if(!Modernizr.svg){
    $('.d3').append('<img src="img/chart.png">');
    $(":contains('The Chart:')").append("<p class='iewarning'>The browser  you are using is outdated so the interactive elements of this chart have been replaced with a static image.</p>");
}
    //*********************************************************************
    // ----- Initialization of the Google map and geocoder
    //*********************************************************************
    var mapOptions = {
        zoom: 7,
        center: new google.maps.LatLng(42.7806, -76.0969),
        mapTypeId: google.maps.MapTypeId.TERRAIN,
        scrollwheel: false
    };

    map = new google.maps.Map($('#map')[0], mapOptions);

    //Add the Google geocoder

    geocoder = new google.maps.Geocoder();

    //*********************************************************************
    // ----- Set up the CartoDB query
    //*********************************************************************




    //*********************************************************************
    // ----- Add the initial CartoDB layers
    //*********************************************************************

    // ----- Add the layer with the county information

    cartodb.createLayer(map, 'http://spatial.cartodb.com/api/v1/viz/nyscnty/viz.json', {
        query: 'select * from {{table_name}}',
        tile_style:countycartoCSS,
        interaction: false

    })
        .on('done', function(layer) {

        map.overlayMapTypes.setAt(0, layer);
        layers.CountyLyr = layer


    });


    // ----- Add the layer with the tract centroids

    cartodb.createLayer(map, 'http://spatial.cartodb.com/api/v1/viz/nystractspt/viz.json', {
        query: 'select * from {{table_name}}',
        tile_style: TRPTcartoCSS,
        interaction: true

    })
        .on('done', function(layer) {
        // map.overlayMapTypes.setAt(1, layer);
        map.overlayMapTypes.setAt(2, layer);
        layers.TractPtLyr = layer
        layer.infowindow.set('template', $('#infoTRPT').html());


    });

        // ----- Add the layer with the tracts but make it invisible
        // ----- I tried avoiding this but had trouble with the interaction

      cartodb.createLayer(map, 'http://spatial.cartodb.com/api/v1/viz/nystracts/viz.json', {
            query: 'select * from {{table_name}}', // if you remove this the query applied in the editor will be used
            tile_style: "#{{table_name}}{polygon-opacity:0}",
            interaction: false
        })
            .on('done', function(layer) {

            
            map.overlayMapTypes.setAt(1, layer);
            layers.Tracts = layer
            

        });


        cartodb.createLayer(map, 'http://spatial.cartodb.com/api/v1/viz/nyscity_25k/viz.json', {
            query: 'select * from {{table_name}}', // if you remove this the query applied in the editor will be used
            tile_style: "#{{table_name}}{marker-opacity:0}",
            interaction: false
        })
            .on('done', function(layer) {


            // layer.infowindow.set('template', $('#infowindow_template').html());
            map.overlayMapTypes.setAt(3, layer);
            layers.PointLyr = layer

            layer.infowindow.set('template', $('#infoCITY').html());

        })
            .on('error', function() {
            cartodb.log.log("some error occurred");
        });




    //*********************************************************************
    // ----- Set up the pull down with all the counties. Note that this
    // ----- can be slow and we could hard code if necessary.
    //*********************************************************************

   getCntyData(true)


    //*********************************************************************
    // ----- PULL-DOWN: if user selects a county from drop down menu
    //*********************************************************************
    
    $('select[name=counties]').change(function() {

        var countyselected = $(this).val()
        var q = "select the_geom from nyscnty where name='" + countyselected + "'";
        var googleOptions = {
            fillOpacity: 0,
            strokeColor: "black",
            strokeWeight: 3,
            strokeOpacity: 0.75,
            draggable: true
        };

        if (polygons == null) {

            // add the county outline
            sql.execute(q).done(addCounty);
			
			//fade in the zoom to county button
			//$('.myButton.zoomtocnty').fadeIn(300).css('display', 'block');
			//$('.myButton.zoomtocnty').fadeIn(300).show();

        } else if (polygons != null && countyselected != 'None Selected') {

            // remove existing county outlines
            removeCounty(polygons)

            // add the county outline
            sql.execute(q).done(addCounty);
			
			//$('.myButton.zoomtocnty').fadeIn(300).show();


        } else if (polygons != null && countyselected == 'None Selected') {

            removeCounty(polygons)
            thesettings.countybounds = null
			
			//fade out the zoom to county button
			//$('.myButton.zoomtocnty').fadeOut(300);

        }

    }); // end county selector button


    //*********************************************************************
    // ----- BUTTON: Zoom to county on click
    //*********************************************************************   

    $('.zoomtocnty').click(function() {

                map.fitBounds(thesettings.countybounds)


    }); // end zoomtocnty

	
	
	//*********************************************************************
    // ----- BUTTON: Zoom to county on click
    //*********************************************************************   

    $('.clearcnty').click(function() {
			
			// Zoom to full state
			zoomNYS()
			
			// Remove county polygons
			removeCounty(polygons)
			
			// Set pulldown to none selected
			$('select[name=counties]').val('None Selected')

    }); // end clearcnty



    //*********************************************************************
    // ----- BUTTON: Remove convex hull on click
    //*********************************************************************   

    $('.removehull').click(function() {

        if (layers.Hull != null) {
            layers.Hull.setMap(null)

            var eth = thesettings.eth.replace("_", "")
            var q = "select * from {{table_name}} where r" + eth + "<=" + thesettings.qcat
            layers.TractPtLyr.setQuery(q)
            layers.TractPtLyr.setCartoCSS(TRPTcartoCSS)
        }
		
		$('input[name=popquery]').val('')

    });



	//*********************************************************************
	// HOLLIE -- this clears the search boxes when a new search is done
	//*********************************************************************		
	
//	$('.wrapper input').click(function(){
//		$('.wrapper #frmSearch').val('')
//	});
	
	$('input[type=search]').click(function(){
		$(this).val('')
	});
	


    //*********************************************************************
    // ----- TEXT BOX: Add hull
    //*********************************************************************   

    $('.pophull').keypress(function(e) {
        if (e.which == 13) {

            var pophull = parseInt($(this).val())
            sql.execute("select ST_ConvexHull(ST_Collect(the_geom)) as the_geom from nystractspt where pop2010>" + pophull).done(function(geojson) {
                var googleOptions = {
                    fillOpacity: 0.5,
                    strokeColor: "black",
                    strokeWeight: 3,
                    strokeOpacity: 0.50
                };
                countiesGeometries = new GeoJSON(geojson, googleOptions);
                // might need to loop through the polygons in a single
                // geometry in case it's multipoly


                if (layers.Hull != null) layers.Hull.setMap(null)

                layers.Hull = countiesGeometries[0]
                layers.Hull.setMap(map)

            });


            // layers.TractPtLyr.setCartoCSS("#{{table_name}} {fill:black}")
             layers.TractPtLyr.setQuery("select * from nystractspt where pop2010>" + pophull)
            layers.TractPtLyr.setCartoCSS("#{{table_name}}{marker-fill:blue}")
            return false; //<---- Add this line
        }
    });


    $('.addhull').click(function() {
       

            var pophull = parseInt($(this).val())
            sql.execute("select ST_ConvexHull(ST_Collect(the_geom)) as the_geom from nystractspt where pop2010>" + 9000).done(function(geojson) {
                var googleOptions = {
                    fillOpacity: 0.5,
                    strokeColor: "black",
                    strokeWeight: 3,
                    strokeOpacity: 0.50
                };
                countiesGeometries = new GeoJSON(geojson, googleOptions);
                // might need to loop through the polygons in a single
                // geometry in case it's multipoly


                if (layers.Hull != null) layers.Hull.setMap(null)

                layers.Hull = countiesGeometries[0]
                layers.Hull.setMap(map)

            });


            // layers.TractPtLyr.setCartoCSS("#{{table_name}} {fill:black}")
             layers.TractPtLyr.setQuery("select * from nystractspt where pop2010>" + 9000)
            layers.TractPtLyr.setCartoCSS("#{{table_name}}{marker-fill:blue}")
            return false; //<---- Add this line
        
    });



    //*********************************************************************
    // ----- TEXT BOX: Select tracts within a distance of (distance)
    //*********************************************************************   

    $('.dist').keypress(function(e) {
        if (e.which == 13) {


           thesettings.TRdist =  parseFloat($(this).val());
            thesettings.TRpeople = parseFloat($(".people").val());
            distFrom(thesettings.TRdist, thesettings.TRpeople);
            return false; //<---- Add this line
        }
    });

//    $('.dist').keypress(function(e) {
//        if (e.which == 13) {
//
//
//           thesettings.TRdist =  parseFloat($(this).val());
//            thesettings.TRpeople = parseFloat($(".people").val());
//            distFrom(thesettings.TRdist, thesettings.TRpeople);
//            return false; //<---- Add this line
//        }
//    });


    //*********************************************************************
    // ----- TEXT BOX: Select tracts within a distance of (population)
    //*********************************************************************   

    $('.people').keypress(function(e) {
        if (e.which == 13) {

            thesettings.TRpeople =  parseFloat($(this).val());
            thesettings.TRdist = parseFloat($(".dist").val());
            distFrom(thesettings.TRdist, thesettings.TRpeople);

            return false; //<---- Add this line
        }
    });
	
	
	$('.distpop').click(function() {

            thesettings.TRpeople =  parseFloat($(".people").val());
            thesettings.TRdist = parseFloat($(".dist").val());
            distFrom(thesettings.TRdist, thesettings.TRpeople);
        
			
    });

    //*********************************************************************
    // ----- Select the country/foreign born
    //*********************************************************************   


    $('select[name=eth]').change(function() {

        thesettings.eth = $(this).val();

        cngTRPTCartoCSS(thesettings.eth, 0.7, 'darken')
        cngTRCartoCSS(thesettings.eth, 0.7, 'darken')
        var eth = thesettings.eth.replace("_", "")
        var q = "select * from {{table_name}} where r" + eth + "<=" + thesettings.qcat

        layers.TractPtLyr.setQuery(q);
                layers.TractPtLyr.setCartoCSS(TRPTcartoCSS)



    });


    //*********************************************************************
    // ----- Limit tracts or tract points to top 5,10,25%
    //*********************************************************************   

    $('select[name=percent]').change(function() {

        var eth = thesettings.eth.replace("_", "")
        thesettings.qcat = $(this).val()

        var q = "select * from {{table_name}} where r" + eth + "<=" + thesettings.qcat
        layers.TractPtLyr.setQuery(q);

    });


    //*********************************************************************
    // BUTTON: when the user clicks on the frmSearch buttom then do the geocode
    //*********************************************************************

    $('.Go').click(codeAddress);

    //*********************************************************************
    // ----- TEXT BOX: if the user presses enter when in the text box
    //*********************************************************************

    $('#frmSearch').keypress(function(e) {
        if (e.which == 13) {
            codeAddress();
            return false; //<---- Add this line
        }
    });

    //*********************************************************************
    // ----- BUTTON: When user clicks on the NYS button should zoom to NYS
    //*********************************************************************

    $('.fullState').click(function() {

        zoomNYS()
		
		// Clear search box
		$('input[name=location]').val('')
    });

    //*********************************************************************
    // ----- BUTTON: Reset dist/pop
    //*********************************************************************

    $('.resetdistpop').click(function() {

        var q = "SELECT * FROM {{table_name}}"
        layers.TractPtLyr.setQuery(q);
        layers.Tracts.setQuery(q);
		
		// Clear search box
		$('input[name=distance]').val('')
		$('input[name=people]').val('')
    
    });

    //*********************************************************************
    // ----- CHECKBOX: Start with county layer and centroid layer checked
    //*********************************************************************

    $('input[name=county]').attr('checked', true);
    $('input[name=centroid]').attr('checked', true);

    //*********************************************************************
    // ----- CHECKBOX: User can turn on or off county layer
    //*********************************************************************

    $('input[name=county]').mousedown(function() {

        if ($(this).is(':checked')) {
            layers.CountyLyr.hide()
            $(this).trigger("change");
        } else {
            layers.CountyLyr.show()
            $(this).trigger("change");
        }
    });

    //*********************************************************************
    // ----- CHECKBOX: User can turn on or off the tract centroid layer
    //*********************************************************************

    $('input[name=centroid]').mousedown(function() {



        if ($(this).is(':checked')) {
            layers.TractPtLyr.hide()
            $(this).trigger("change");
        } else {
            layers.TractPtLyr.show()
            $(this).trigger("change");
        }
    });


    //*********************************************************************
    // ----- CHECKBOX: tract outlines start off so we need to add the layer
    // ----- if checked
    //*********************************************************************

    $('input[name=outline]').mousedown(function() {

        cngTRCartoCSS(thesettings.eth, 0.75, 'darken');
        layers.Tracts.setCartoCSS(TRcartoCSS);
        var q = 'select * from {{table_name}}'

        // if the user has limited tracts by distance or centroid then 
        // we need to account for this. This query is too slow right now
        if(thesettings.TRdist!=null){

            var q = "select * from nystracts WHERE fips IN \
            (SELECT fips FROM nystractspt INNER JOIN (select ST_Buffer(the_geom, " + radDegFromMiles(thesettings.TRdist) + ") as the_geom, pop2007 \
            from nyscity_25k where pop2007 > " + thesettings.TRpeople + ") t \
            ON ST_Intersects(nystractspt.the_geom,t.the_geom)) "

            
        }


        if ($(this).is(':checked')) {
            layers.Tracts.hide()
            $(this).trigger("change");
        } else {
            layers.Tracts.show()
            $(this).trigger("change");
        }
    });


    $('input[name=city]').mousedown(function() {

        layers.PointLyr.setCartoCSS(citycartoCSS);

        if ($(this).is(':checked')) {
            layers.PointLyr.hide()
            $(this).trigger("change");
        } else {
            layers.PointLyr.show()
            $(this).trigger("change");
        }
    });



}); //end doc ready

    //*********************************************************************
    // ----- Select the country/foreign born
    //*********************************************************************   


    $('select[name=ethd3]').change(function() {

        thesettings.ethd3 = $(this).val();

getCntyData(false)




    });


//*********************************************************************
// ----- Rest Tract Point layer to limit to points within a distance
// ----- of cities with a certain population
//*********************************************************************

function distFrom(dist, people) {

    var querypt = "select * from nystractspt \
            INNER JOIN (select ST_Buffer(the_geom, " + radDegFromMiles(dist) + ") as the_geom, pop2007 \
            from nyscity_25k where pop2007 > " + people + ") t \
            ON ST_Intersects(nystractspt.the_geom,t.the_geom) "

    layers.TractPtLyr.setQuery(querypt);

if(layers.Tracts!=null){
    var query = "select * from nystracts WHERE fips IN \
            (SELECT fips FROM nystractspt INNER JOIN (select ST_Buffer(the_geom, " + radDegFromMiles(dist) + ") as the_geom, pop2007 \
            from nyscity_25k where pop2007 > " + people + ") t \
            ON ST_Intersects(nystractspt.the_geom,t.the_geom)) "


    layers.Tracts.setQuery(query);
}
}


//*********************************************************************
// ----- Function for changing the cartoCSS for the tract points
//*********************************************************************

function cngTRPTCartoCSS(eth, opac, compositing) {

    TRPTcartoCSS = "#nystractspt{ \
[" + eth + ">=0] {marker-fill: #F1B710;} \
[" + eth + "> 5] {marker-fill: #F28F15;} \
[" + eth + "> 10] {marker-fill: #F25C0A;} \
[" + eth + ">15] {marker-fill: #BF2705;} \
[" + eth + ">30] {marker-fill: #730502;} \
    marker-opacity:" + opac + "; \
    marker-width: 8; \
    marker-line-width: 0; \
    marker-placement: point; \
    marker-type: ellipse; \
    marker-allow-overlap: true; \
    marker-comp-op:" + compositing + "; \
} \
#nystractspt[zoom>8]{ \
    marker-opacity:1; \
    marker-line-width: 0; \
    marker-line-color: grey; \
}"


}



//*********************************************************************
// ----- Function for changing the cartoCSS for the tract polys
//*********************************************************************

function cngTRCartoCSS(eth, opac, compositing) {

    TRcartoCSS = "#{{table_name}}{ \
    polygon-opacity:" + opac + "; \
    line-color:grey; \
    line-opacity:0.8; \
[" + eth + ">=0] {polygon-fill: #F1B710;} \
[" + eth + ">5] {polygon-fill: #F28F15;} \
[" + eth + ">10] {polygon-fill: #F25C0A;} \
[" + eth + ">15] {polygon-fill: #BF2705;} \
[" + eth + ">30] {polygon-fill: #730502;} \
}"

}



//*********************************************************************
// ----- If needed, to convert degrees to meters
//*********************************************************************


function radDegFromMiles(dist) {
    dist = dist / 0.000621371 // convert to meters
    lat = 42.7806 // set lat and lng to center of NYS
    lng = -76.0969
    var deg = 180,
        brng = deg * Math.PI / 180,
        dist = dist / 6371000,
        lat1 = lat * Math.PI / 180,
        lon1 = lng * Math.PI / 180;

    var lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) +
        Math.cos(lat1) * Math.sin(dist) * Math.cos(brng));

    var lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dist) * Math.cos(lat1), Math.cos(dist) -
        Math.sin(lat1) * Math.sin(lat2));

    if (isNaN(lat2) || isNaN(lon2)) return null;

    radDeg = lat - (lat2 * 180 / Math.PI)
    return radDeg
}


//*********************************************************************
// ----- Geocode address
//*********************************************************************


function codeAddress() {
    var address = document.getElementById("frmSearch").value;
    geocoder.geocode({
        'address': address
    }, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            map.setCenter(results[0].geometry.location);
            //var marker = new google.maps.Marker({
            //   map: map, 
            //      position: results[0].geometry.location
            //  });
            if (results[0].geometry.viewport)
                map.fitBounds(results[0].geometry.viewport);
        } else {
            alert("Geocode was not successful for the following reason: " + status);
        }
    });
}

//*********************************************************************
// ----- Zoom to full NYS
//*********************************************************************

function zoomNYS() {
    map.setCenter(new google.maps.LatLng(42.8406, -76.0969));
    map.setZoom(7);
}

//*********************************************************************
// ----- Add county to map
//*********************************************************************

 
function addCounty(geojson){
              countiesGeometries = new GeoJSON(geojson, googleOptions);
                thesettings.countybounds = GeoJSON.getBounds(countiesGeometries)

                polygons = countiesGeometries[0]
                for (var p = 0; p < polygons.length; ++p) {
                    polygons[p].setMap(map);

}
}


//*********************************************************************
// ----- Remove county outline (note that there might be multiple polygons)
//*********************************************************************

function removeCounty(polygons){

     $.each(polygons, function(key, value) {
                polygons[key].setVisible(false)
            })

}

//*********************************************************************
// ----- Get county data
//*********************************************************************

function getCntyData(fillpulldown){

    var tmpdata = [];
    // var q = 'select the_geom, name, fips,"' + thesettings.ethd3 + '" from nyscnty';
     var q = 'select  name, fips,"' + thesettings.ethd3 + '" from nyscnty';
        sqljson.execute(q).done(function(data) {
            
            for (var i = 0; i < data.rows.length; ++i) {
                tmpdata.push([data.rows[i].name,data.rows[i][thesettings.ethd3]])
                
            }

 // for (var i = 0; i < data.features.length; ++i) {
 //                tmpdata.push([data.features[i].properties.name,data.features[i].properties[thesettings.ethd3]])
 //            }


            thesettings.cntydata = tmpdata 
            if(fillpulldown){fillPullDown()}

            if(Modernizr.svg) {addD3()}


        });

    }


//*********************************************************************
// ----- Populated the county pull down menu
//*********************************************************************


function fillPullDown() {

    var dat = [];
    for (var i = 0; i < thesettings.cntydata.length; i++) {
        dat.push(thesettings.cntydata[i][0])
    };

    dat.sort().unshift("None Selected")
    $.each(dat, function(key, value) {
        $("select[name=counties]").append("<option value = '" + value + "'>" + value + "</option>");

    });
	
//	dat.sort().unshift("None Selected")
//    $.each(dat, function(key, value) {
//        $("select[name=counties]").append("<option value = '" + value + "'>" + value + "</option>");
//
//    });
}


//*********************************************************************
// ----- Add the D3 chart
//*********************************************************************

function addD3() {
	
	var wd3 =600;
	var hd3 =500;

    var nyscnty = thesettings.cntydata
    // nyscnty.sort(function(a, b) {
    //   return a[1] - b[1];
    // });

    nyscnty.sort()
    //we will need the min and max of the variable for scaling
    var maxval = d3.max(nyscnty, function(d) {
        return d[1]
    });

    var minval = d3.min(nyscnty, function(d) {
        return d[1]
    });


    // create the x scale function
    var xScale = d3.scale.ordinal()
        .domain(d3.range(nyscnty.length))
        .rangeBands([0, wd3], 0.01);



    // y scale
    var yScale = d3.scale.linear()
        .domain([minval, maxval])
        .range([hd3, 0]);


    var yAxis = d3.svg.axis()
        .scale(yScale)
        .orient("right")
        .ticks(5)
        .tickFormat(function(d) {
        return d + '%'
    })
        .tickSize(7, 0, 0); //setting last one to 0 suppresses end ticks

if(d3.selectAll("svg")[0].length < 2){

    svgchart = d3.select(".d3")
        .insert("svg")
        .attr("width", wd3 + 50)
        .attr("height", hd3+5);

    svgchart.selectAll("rect")
        .data(nyscnty)
        .enter()
        .append("rect")
        .attr("fill", "black")
                        .attr("x", function(d, i) {
        return xScale(i);
    })
        .attr("y", function(d) {
        return yScale(d[1]);
    })
        .attr("height", function(d, i) {
        return hd3 - yScale(d[1]);
    })
        .attr("width", (wd3 / nyscnty.length) - 2)
        .on("mouseover", function(d) {
        d3.select(this).attr("fill", "red");

    });


    svgchart.selectAll("rect.fortitle")
        .data(nyscnty)
        .enter()
        .append("rect")
        .attr("class", "fortitle")
        .attr("fill", "black")
        .attr("opacity", 0)
         .attr("x", function(d, i) {
        return xScale(i);
    })
        .attr("y",0)
        .attr("height", hd3)
        .attr("width", (wd3 / nyscnty.length) - 2)
        .on("mouseover", function(d) {
        d3.select(this).attr("fill", "blue").attr("opacity", .2);

    })
        .on("mouseout", function(d) {
        d3.select(this)
            .transition()
            .duration(250)
            .attr("fill", "black").attr("opacity", 0);


    })
        .append("title")
        .text(function(d) {
        return d[0];
    });


    svgchart.append("g")
        .attr("transform", "translate(" + wd3 + ", 0)") //the three pushes the axis down just a tiny bit so it shows
    .attr("class", "axis")
        .call(yAxis);
} else {


    svgchart.selectAll("rect")
    .data(nyscnty)
    .transition()
    .duration(750)
    .attr("y", function(d) {
        return yScale(d[1]);
    })
    .attr("height", function(d, i) {
        return hd3 - yScale(d[1]);
    });

        svgchart.select(".axis")//the three pushes the axis down just a tiny bit so it shows
        .transition()
        .duration(750)
        .call(yAxis);

}


}