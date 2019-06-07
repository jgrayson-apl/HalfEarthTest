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

  // https://codepen.io/john-grayson/pen/QRRGBY?editors=1000

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

    _startAngleRadians: ((225.0 - 90.0) * Math.PI / 180.0),
    _endAngleRadians: ((315.0 - 90.0) * Math.PI / 180.0),

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
      color: {
        type: String
      },
      progress: {
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

      this.arcWidth = 50;
      this.arcOffset = 0;
      this.position = {
        width: 200,
        height: 200,
        center_x: 100,
        center_y: 100,
        radius: 100
      };

    },

    /**
     *
     * @param angleRadians
     * @param arcCenterRadius
     * @returns {{x: number, y: number}}
     * @private
     */
    _getLinearGradientCoordinate: function (angleRadians, arcCenterRadius) {
      return {
        x: this.position.center_x + (Math.cos(angleRadians) * arcCenterRadius),
        y: this.position.center_y + (Math.sin(angleRadians) * arcCenterRadius)
      };

    },

    /**
     *
     * @private
     */
    _updateIndicatorDisplay: function () {
      if(this.context) {

        const arcCenterRadius = (this.position.radius + this.arcOffset + (this.arcWidth * 0.5));

        const arcStartCoords = this._getLinearGradientCoordinate(this._startAngleRadians, arcCenterRadius);
        const arcEndCoords = this._getLinearGradientCoordinate(this._endAngleRadians, arcCenterRadius);

        const gradient = this.context.createLinearGradient(arcStartCoords.x, arcStartCoords.y, arcEndCoords.x, arcEndCoords.y);
        gradient.addColorStop(0.0, this.color);
        gradient.addColorStop(((this.progress * 2.0) / 100.0), this.color);
        gradient.addColorStop((((this.progress + 10) * 2.0) / 100.0), "transparent");
        gradient.addColorStop(1.0, "transparent");

        this.context.globalAlpha = 0.05;
        this.context.beginPath();
        this.context.arc(this.position.center_x, this.position.center_y, arcCenterRadius, 0.0, (2 * Math.PI));
        this.context.strokeStyle = this.color;
        this.context.lineWidth = this.arcWidth;
        this.context.stroke();

        this.context.globalAlpha = 1.0;
        this.context.beginPath();
        this.context.arc(this.position.center_x, this.position.center_y, arcCenterRadius, this._startAngleRadians, this._endAngleRadians);
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

          // VIEW SETTINGS //
          this.updateViewSettings();

          // create canvas
          this.canvas = document.createElement("canvas");
          this.canvas.style.userSelect = "none";
          this.canvas.style.pointerEvents = "none";
          this.canvas.style.width = `100%`;
          this.canvas.style.height = `100%`;
          this.view.ui.add(this.canvas);

          this.context = this.canvas.getContext("2d");

          this.indicators = new HaloIndicatorCollection();
          this.indicators.watch("length", this._updateHaloDisplay.bind(this));

          this.view.watch("zoom", this._updateHaloDisplay.bind(this));

          // this.watch("glowEnabled", this._updateHaloDisplay.bind(this));
          // this.watch("atmosphereEnabled", this._updateHaloDisplay.bind(this));
        }
      },
      canvas: {
        type: HTMLCanvasElement
      },
      context: {
        type: CanvasRenderingContext2D
      },
      glowEnabled: {
        type: Boolean
      },
      atmosphereEnabled: {
        type: Boolean,
        aliasOf: "view.environment.atmosphereEnabled"
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

      this.glowEnabled = false;
      this.atmosphereEnabled = false;
      this.indicatorWidth = 25;
      this.indicatorGap = 2;

    },

    /**
     *
     */
    updateViewSettings: function () {

      // reduce default minimum tilt to 0.01
      Constraints.TiltDefault.min = (0.01 / 180 * Math.PI);

      // constrain max altitude
      this.view.constraints.altitude.max = 40000000;

      // scene environment
      this.view.environment = {
        atmosphereEnabled: this.atmosphereEnabled,
        atmosphere: { quality: "high" }
      };

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
        options.arcOffset = options.index * (options.arcWidth + options.arcGap);

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

      const updatedPosition = {
        radius: radiusPixels,
        center_x: (this.canvas.width / 2),
        center_y: (this.canvas.height / 2) + 3,
        width: this.canvas.width,
        height: this.canvas.height
      };

      if(this.glowEnabled) {
        // UPDATE GLOW //
        this._updateGlow(updatedPosition);
      }

      // UPDATE INDICARORS //
      this.indicators.forEach(indicator => {
        indicator.position = updatedPosition;
      });

    },

    /**
     *
     * @param position
     * @private
     */
    _updateGlow: function (position) {

      const glowGradient = this.context.createRadialGradient(
          position.center_x, position.center_y, position.radius,
          position.center_x, position.center_y, Math.max(position.width, position.height));

      glowGradient.addColorStop(0, "transparent");
      glowGradient.addColorStop(0.001, "rgba(255,255,255,0.2)");
      glowGradient.addColorStop(0.2, "rgba(255,255,255,0.1)");
      glowGradient.addColorStop(1, "transparent");

      this.context.fillStyle = glowGradient;
      this.context.fillRect(0, 0, position.width, position.height);

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

        if(this.atmosphereEnabled) {
          this._updateHaloCanvas(r_projected + 3);
        } else {
          this._updateHaloCanvas(r_projected);
        }
      } else {
        this._clearHaloCanvas();
      }
    }

  });

  HalfEarthHalo.version = "0.0.1";

  return HalfEarthHalo;
});
