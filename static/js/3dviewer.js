const TILESET = 'static/tile/taichung/tileset.taichung.json'; // area: 43km^2, building amount: 60,000, file size: 146MB

const DEBUG = true;
const NUMBER = 500;

var tilesetAttributes = new Array();
var viewer;
var tilesets;

$(document).ready(function () {
    viewer = new Cesium.Viewer('cesiumContainer', {
        selectionIndicator: false
    });
    tilesets = viewer.scene.primitives._primitives;
    
    viewer.scene.globe.baseColor = Cesium.Color.BLACK;
    // viewer.imageryLayers.removeAll();

    viewer.camera.setView({
        destination : Cesium.Cartesian3.fromDegrees(119.57627, 23.600425, 100000)
    });
    
    for (let i = 0; i < NUMBER; i++) {
        load3DTileset(DEBUG);
    }

    setTimeout(function() {
        viewer.camera.percentageChanged = 0.5;
        viewer.camera.moveEnd.addEventListener(function() {
            unloadInvisibleTilesets();
        });
    }, 1000);

});

function load3DTileset(debug = false) {
    let tileset = viewer.scene.primitives.add(new Cesium.Cesium3DTileset({
        url : TILESET,
        skipLevelOfDetail: true,
        immediatelyLoadDesiredLevelOfDetail: true,
        dynamicScreenSpaceError: true,
        maximumScreenSpaceError: 16,
        debugColorizeTiles: debug,
        debugShowBoundingVolume: debug
    }));
    
    tileset.readyPromise.then(function(tileset) {
        let location = getTaiwanRandomLocation();
        translateTo(tileset, location.latitude, location.longitude);
    });
}

function see(tileset = tilesets[0]) {
    viewer.zoomTo(tileset);
}

function translate(tileset = tilesets[0], x = 0, y = 0, z = 0) {

    let xRadian = Cesium.Math.toRadians(x);
    let yRadian = Cesium.Math.toRadians(y);

    var cartographic = Cesium.Cartographic.fromCartesian(tileset.boundingSphere.center);
    var surface = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0.0);
    var offset = Cesium.Cartesian3.fromRadians(cartographic.longitude + yRadian, cartographic.latitude + xRadian, z);
    var translation = Cesium.Cartesian3.subtract(offset, surface, new Cesium.Cartesian3());

    Cesium.Matrix4.multiply(tileset.modelMatrix, Cesium.Matrix4.fromTranslation(translation), tileset.modelMatrix);
}

function translateTo(tileset = tilesets[0], latitude, longitude) {
    var cartographic = Cesium.Cartographic.fromCartesian(tileset.boundingSphere.center);
    var surface = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, cartographic.height);
    var newSurface = Cesium.Cartesian3.fromDegrees(longitude, latitude, cartographic.height);

    var translation = Cesium.Cartesian3.subtract(newSurface, surface, new Cesium.Cartesian3());
    Cesium.Matrix4.multiply(tileset.modelMatrix, Cesium.Matrix4.fromTranslation(translation), tileset.modelMatrix);

    if (!tileset.latitude || !tileset.longitude) {
        tileset.latitude = latitude;
        tileset.longitude = longitude;
    }
}

function imageryOpacity(o) {
    viewer.imageryLayers.get(0).alpha = o;
}

function closeImagery() {
    viewer.scene.imageryLayers.get(0).show = false;
}

function openImagery() {
    viewer.scene.imageryLayers.get(0).show = true;
}

function getTaiwanRandomLocation() {
    let ranLat = Math.random();
    let ranLon = Math.random();
    let latitude = 25.2353 + (22.724479 - 25.2353) * ranLat;
    let longitude = 121.127993 + (119.9650-121.127993)*ranLat + (122.0781-121.127993)*ranLon;

    return {
        latitude: latitude,
        longitude: longitude
    };
}

function unloadTileset(tileset) {
    let url = tileset.url;
    let latitude = tileset.latitude;
    let longitude = tileset.longitude;

    viewer.scene.primitives.remove(tileset);

    let newTileset = viewer.scene.primitives.add(new Cesium.Cesium3DTileset({
        url : url,
        skipLevelOfDetail: true,
        immediatelyLoadDesiredLevelOfDetail: true,
        dynamicScreenSpaceError: true,
        maximumScreenSpaceError: 16,
        debugColorizeTiles: DEBUG,
        debugShowBoundingVolume: DEBUG,
    }));

    newTileset.readyPromise.then(function(t) {
        translateTo(t, latitude, longitude);
    });
}

function unloadInvisibleTilesets() {

    let cameraRectangle = viewer.camera.computeViewRectangle();
    let west = Cesium.Math.toDegrees(cameraRectangle.west);
    let south = Cesium.Math.toDegrees(cameraRectangle.south);
    let east = Cesium.Math.toDegrees(cameraRectangle.east);
    let north = Cesium.Math.toDegrees(cameraRectangle.north);

    let middleLatitude = (south + north) / 2;
    let viewAreaWidth = getDistanceFromLatLon(middleLatitude, west, middleLatitude, east);
    let middleLongitude = (west + east) / 2;
    let viewAreaHeight = getDistanceFromLatLon(south, middleLongitude, north, middleLongitude);

    let amount = tilesets.length;

    for (let i = 0; i < amount; i++) {
        if (invisibleJudge(tilesets[i], viewAreaHeight, viewAreaWidth, middleLatitude, middleLongitude) == 'OUT') {
            unloadTileset(tilesets[i]);
            amount -= 1;
            i -= 1;
        }
    }
}

function invisibleJudge(tileset, viewAreaHeight, viewAreaWidth, middleLatitude, middleLongitude) {

    let cartographic = Cesium.Cartographic.fromCartesian(tileset.boundingSphere.center);
    let mbsLat = Cesium.Math.toDegrees(cartographic.latitude);
    let mbsLon = Cesium.Math.toDegrees(cartographic.longitude);
    let mbsR = tileset.boundingSphere.radius;

    let diagonal = Math.sqrt(viewAreaHeight * viewAreaHeight + viewAreaWidth * viewAreaWidth);
    let distance = getDistanceFromLatLon(middleLatitude, middleLongitude, mbsLat, mbsLon);

    if (distance > (diagonal + mbsR)) {
        return 'OUT';
    }
    if (getDistanceFromLatLon(middleLatitude, middleLongitude, mbsLat, middleLongitude) > (viewAreaHeight * 0.5 + mbsR)) {
        return 'OUT';
    }
    if (getDistanceFromLatLon(middleLatitude, middleLongitude, middleLatitude, mbsLon) > (viewAreaWidth * 0.5 + mbsR)) {
        return 'OUT';
    }
    
    return 'IN';
}

function getDistanceFromLatLon(lat1, lon1, lat2, lon2) {
    var R = 6371000; // Radius of the earth
    var dLat = Cesium.Math.toRadians(lat2 - lat1);
    var dLon = Cesium.Math.toRadians(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(Cesium.Math.toRadians(lat1)) * Math.cos(Cesium.Math.toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in 
    return d;
}