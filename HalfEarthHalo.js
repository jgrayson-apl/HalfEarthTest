/**
 *
 * HalfEarthHalo
 *  - Custom indicator halo for Half Earth web app
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  6/5/2019 - 0.0.1 -
 * Modified:
 *
 */
define([
  "esri/core/Accessor",
  "esri/core/Evented",
  "esri/core/Collection",
  "esri/views/SceneView",
  "esri/views/3d/state/Constraints",
], function (Accessor, Evented, Collection, SceneView, Constraints) {

  // https://codepen.io/john-grayson/pen/XwOWwQ?editors=1000

  // 0deg   - 1.5 * Pi,
  // 90deg  - 0   * Pi,
  // 180deg - 0.5 * Pi,
  // 270deg - 1   * Pi
  // 360deg - 1.5 * Pi

  /**
   *
   */
  const HaloIndicator = Accessor.createSubclass([Evented], {
    declaredClass: "HaloIndicator",

    properties: {
      context: {
        type: CanvasRenderingContext2D
      },
      arcWidth: {
        type: Number
      },
      arcOffset: {
        type: Number
      },
      colorStops: {
        type: Array
      },
      startAngle: {
        type: Number
      },
      endAngle: {
        type: Number
      },
      position: {
        type: Object,
        set: function (value) {
          this._set("position", value);
          this._updateIndicatorDisplay();
        }
      }
    },

    /**
     *
     */
    constructor: function () {

      this.colorStops = [];
      this.startAngle = (0.5 * Math.PI);
      this.endAngle = (1.5 * Math.PI);
      this.arcWidth = 50;
      this.arcOffset = 0;
      this.position = {
        width: 200,
        height: 200,
        radius: 100
      };

    },

    /**
     *
     * @private
     */
    _updateIndicatorDisplay: function () {
      if(this.context) {

        const center_x = (this.position.width * 0.5);
        const center_y = (this.position.height * 0.5);

        const gradient = this.context.createLinearGradient(center_x, this.position.height, center_x, 0);
        this.colorStops.forEach(colorStop => {
          gradient.addColorStop(colorStop.value, colorStop.color);
        });

        this.context.beginPath();
        this.context.arc(center_x, center_y, this.position.radius + this.arcOffset, 0, 2 * Math.PI, false);
        this.context.strokeStyle = "rgba(255,255,255,0.1)";
        this.context.lineWidth = this.arcWidth;
        this.context.stroke();

        this.context.beginPath();
        this.context.arc(center_x, center_y, this.position.radius + this.arcOffset, this.startAngle, this.endAngle);
        this.context.strokeStyle = gradient;
        this.context.lineWidth = this.arcWidth;
        this.context.lineCap = "round";
        this.context.stroke();

      }
    }

  });

  /**
   *
   */
  const HaloIndicatorCollection = Collection.ofType(HaloIndicator);

  /**
   *
   */
  const HalfEarthHalo = Accessor.createSubclass([Evented], {
    declaredClass: "HalfEarthHalo",

    EARTH_RADIUS: 6378137,

    properties: {
      view: {
        type: SceneView,
        set: function (value) {
          this._set("view", value);

          // reduce default minimum tilt to 0.01
          Constraints.TiltDefault.min = (0.01 / 180 * Math.PI);

          // constrain max altitude
          this.view.constraints.altitude.max = 40000000;

          // create canvas
          this.canvas = document.createElement("canvas");
          this.canvas.style.userSelect = "none";
          this.canvas.style.pointerEvents = "none";
          this.canvas.style.display = "flex";
          this.canvas.style.justifyContent = "center";
          this.canvas.style.alignItems = "center";
          this.canvas.style.width = `${this.view.width}px`;
          this.canvas.style.height = `${this.view.height}px`;
          this.view.ui.add(this.canvas);

          this.context = this.canvas.getContext("2d");

          this.view.watch("zoom", this._updateHaloDisplay.bind(this));

        }
      },
      canvas: {
        type: HTMLCanvasElement
      },
      context: {
        type: CanvasRenderingContext2D,
        set: function (value) {
          this._set("context", value);
          this.indicators = new HaloIndicatorCollection();
          this.indicators.watch("length", this._updateHaloDisplay.bind(this));
        }
      },
      indicatorWidth: {
        type: Number
      },
      indicatorGap: {
        type: Number
      },
      indicators: {
        type: HaloIndicatorCollection
      }
    },

    /**
     *
     */
    constructor: function () {

      this.indicatorWidth = 30;
      this.indicatorGap = 1;

    },

    /**
     *
     * @param options
     */
    addIndicator: function (options) {
      if(this.context) {

        options.context = this.context;
        options.arcWidth = options.indicatorWidth || this.indicatorWidth;
        options.arcGap = options.indicatorGap || this.indicatorGap;

        this.indicators.add(options);

      } else {
        throw  new Error("HalfEarthHalo.addIndicator: canvas rendering context is NOT set...");
      }
    },

    /**
     *
     */
    _clearHaloCanvas: function () {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    },

    /**
     *
     * @param radiusPixels
     */
    _updateHaloCanvas: function (radiusPixels) {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.canvas.width = this.view.width;
      this.canvas.height = this.view.height;

      this.indicators.forEach(indicator => {
        indicator.position = {
          radius: radiusPixels,
          width: this.canvas.width,
          height: this.canvas.height
        };
      });

    },

    /**
     *
     * @param x
     * @param x0
     * @param x1
     * @param y0
     * @param y1
     * @returns {Number}
     */
    _interpolate: function (x, x0, x1, y0, y1) {
      return (x - x0) / (x1 - x0) * (y1 - y0) + y0;
    },

    /**
     *
     * @returns {boolean}
     */
    _adjustTilt: function () {
      let constrained = false;
      const altitude = this.view.camera.position.z;
      if(altitude < 4000) this.view.constraints.tilt.max = 180;
      else if(altitude < 50000) this.view.constraints.tilt.max = this._interpolate(altitude, 4000, 50000, 180, 88);
      else if(altitude < 500000) this.view.constraints.tilt.max = 88;
      else if(altitude < 10000000) this.view.constraints.tilt.max = this._interpolate(altitude, 500000, 10000000, 88, 0.01);
      else {
        this.view.constraints.tilt.max = 0.01;
        constrained = true;
      }
      return constrained;
    },

    /**
     *
     * @param zoom
     */
    _updateHaloDisplay: function (zoom) {

      const constrained = this._adjustTilt();
      if(constrained) {

        // position of the camera in space
        const e = this.view.state.camera.eye;
        // distance from camera to earth center
        const d = Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
        // radius of earth as projected to screen, in pixels
        const r_projected = (1 / Math.tan(this.view.state.camera.fovY / 2)
            * this.EARTH_RADIUS / Math.sqrt(d * d - this.EARTH_RADIUS * this.EARTH_RADIUS)
            * this.view.height / 2);

        // update circle radius
        this._updateHaloCanvas(r_projected + 15 || 150);
      } else {
        this._clearHaloCanvas();
      }
    }

  });

  HalfEarthHalo.version = "0.0.1";

  return HalfEarthHalo;
});
