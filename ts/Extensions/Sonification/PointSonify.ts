/* *
 *
 *  (c) 2009-2021 Øystein Moseng
 *
 *  Code for sonifying single points.
 *
 *  License: www.highcharts.com/license
 *
 *  !!!!!!! SOURCE GETS TRANSPILED BY TYPESCRIPT. EDIT TS FILE ONLY. !!!!!!!
 *
 * */

'use strict';

/* *
 *
 *  Imports
 *
 * */

import type Instrument from './Instrument';
import type Point from '../../Core/Series/Point';
import type RangeSelector from '../../Extensions/RangeSelector';

import Sonification from './Sonification.js';
import U from '../../Core/Utilities.js';
const {
    error,
    merge,
    pick
} = U;
import SU from './SonificationUtilities.js';

/* *
 *
 *  Constants
 *
 * */

const composedClasses: Array<Function> = [];

// Defaults for the instrument options
// NOTE: Also change defaults in Highcharts.PointInstrumentOptionsObject if
//       making changes here.
const defaultInstrumentOptions: PointSonify.PointInstrumentOptions = {
    minDuration: 20,
    maxDuration: 2000,
    minVolume: 0.1,
    maxVolume: 1,
    minPan: -1,
    maxPan: 1,
    minFrequency: 220,
    maxFrequency: 2200
};

/* eslint-disable valid-jsdoc */

/* *
 *
 *  Composition
 *
 * */

/**
 * @private
 */

namespace PointSonify {

    /* *
     *
     * Declarations
     *
     * */

    export declare class Composition extends Point {
        pointCancelSonify(this: Highcharts.SonifyablePoint, fadeOut?: boolean): void;
        pointSonify(
            this: Highcharts.SonifyablePoint,
            options: Options
        ): void;
    }

    export interface PointInstrumentMapping {
        [key: string]: (number|string|Function);
        duration: (number|string|Function);
        frequency: (number|string|Function);
        pan: (number|string|Function);
        volume: (number|string|Function);
    }
    export interface PointInstrument {
        instrument: (string|Instrument);
        instrumentMapping: PointInstrumentMapping;
        instrumentOptions?: Partial<PointInstrumentOptions>;
        onEnd?: Function;
    }
    export interface PointInstrumentOptions {
        maxDuration: number;
        minDuration: number;
        maxFrequency: number;
        minFrequency: number;
        maxPan: number;
        minPan: number;
        maxVolume: number;
        minVolume: number;
    }
    export interface Options {
        dataExtremes?: Record<string, RangeSelector.RangeObject>;
        instruments: Array<PointInstrument>;
        onEnd?: Function;
        masterVolume?: number;
    }

    /* *
     *
     *  Functions
     *
     * */

    /**
     * Extends the axis with ordinal support.
     *
     * @private
     *
     * @param PointClass
     * Point class to extend.
     */
    export function compose<T extends typeof Point>(
        PointClass: T
    ): (typeof Composition&T) {

        if (composedClasses.indexOf(PointClass) === -1) {
            composedClasses.push(PointClass);

            const pointProto = PointClass.prototype as Composition;

            pointProto.sonify = pointSonify;
            pointProto.cancelSonify = pointCancelSonify;

        }
        return PointClass as (typeof Composition&T);
    }

    /**
     * Sonify a single point.
     *
     * @sample highcharts/sonification/point-basic/
     *         Click on points to sonify
     * @sample highcharts/sonification/point-advanced/
     *         Sonify bubbles
     *
     * @requires module:modules/sonification
     *
     * @function Highcharts.Point#sonify
     *
     * @param {Highcharts.PointSonifyOptionsObject} options
     * Options for the sonification of the point.
     *
     * @return {void}
     */
    function pointSonify(
        this: Highcharts.SonifyablePoint,
        options: PointSonify.Options
    ): void {
        const point = this,
            chart = point.series.chart,
            masterVolume = pick(
                options.masterVolume,
                chart.options.sonification &&
                chart.options.sonification.masterVolume
            ),
            dataExtremes = options.dataExtremes || {},
            // Get the value to pass to instrument.play from the mapping value
            // passed in.
            getMappingValue = function (
                value: (number|string|Function),
                makeFunction: boolean,
                allowedExtremes: RangeSelector.RangeObject
            ): (number|Function) {
                // Function. Return new function if we try to use callback,
                // otherwise call it now and return result.
                if (typeof value === 'function') {
                    return makeFunction ?
                        function (time: any): any {
                            return value(point, dataExtremes, time);
                        } :
                        value(point, dataExtremes);
                }
                // String, this is a data prop. Potentially with
                // negative polarity.
                if (typeof value === 'string') {
                    const hasInvertedPolarity = value.charAt(0) === '-';
                    const dataProp = hasInvertedPolarity ? value.slice(1) : value;
                    const pointValue = pick((point as any)[dataProp], (point.options as any)[dataProp]);

                    // Find data extremes if we don't have them
                    dataExtremes[dataProp] = dataExtremes[dataProp] ||
                        SU.calculateDataExtremes(
                            point.series.chart, dataProp
                        );

                    // Find the value
                    return SU.virtualAxisTranslate(
                        pointValue,
                        dataExtremes[dataProp],
                        allowedExtremes,
                        hasInvertedPolarity
                    );
                }
                // Fixed number or something else weird, just use that
                return value;
            };

        // Register playing point on chart
        chart.sonification.currentlyPlayingPoint = point;

        // Keep track of instruments playing
        point.sonification = point.sonification || {};
        point.sonification.instrumentsPlaying =
            point.sonification.instrumentsPlaying || {};

        // Register signal handler for the point
        const signalHandler = point.sonification.signalHandler =
            point.sonification.signalHandler ||
            new SU.SignalHandler(['onEnd']);

        signalHandler.clearSignalCallbacks();
        signalHandler.registerSignalCallbacks({ onEnd: options.onEnd });

        // If we have a null point or invisible point, just return
        if (point.isNull || !point.visible || !point.series.visible) {
            signalHandler.emitSignal('onEnd');
            return;
        }

        // Go through instruments and play them
        options.instruments.forEach(function (
            instrumentDefinition: PointSonify.PointInstrument
        ): void {
            const instrument = typeof instrumentDefinition.instrument === 'string' ?
                    Sonification.instruments[instrumentDefinition.instrument] :
                    instrumentDefinition.instrument,
                mapping = instrumentDefinition.instrumentMapping || {},
                extremes = merge(
                    defaultInstrumentOptions,
                    instrumentDefinition.instrumentOptions
                ),
                id = instrument.id,
                onEnd = function (this: any, cancelled?: boolean): void {
                    // Instrument on end
                    if (instrumentDefinition.onEnd) {
                        instrumentDefinition.onEnd.apply(this, arguments);
                    }

                    // Remove currently playing point reference on chart
                    if (
                        chart.sonification &&
                        chart.sonification.currentlyPlayingPoint
                    ) {
                        delete chart.sonification.currentlyPlayingPoint;
                    }

                    // Remove reference from instruments playing
                    if (
                        point.sonification && point.sonification.instrumentsPlaying
                    ) {
                        delete point.sonification.instrumentsPlaying[id];

                        // This was the last instrument?
                        if (
                            !Object.keys(
                                point.sonification.instrumentsPlaying
                            ).length
                        ) {
                            signalHandler.emitSignal('onEnd', cancelled);
                        }
                    }
                };

            // Play the note on the instrument
            if (instrument && instrument.play) {
                if (typeof masterVolume !== 'undefined') {
                    instrument.setMasterVolume(masterVolume);
                }

                (point.sonification.instrumentsPlaying as any)[instrument.id] =
                    instrument;
                instrument.play({
                    frequency: getMappingValue(
                        mapping.frequency,
                        true,
                        { min: extremes.minFrequency, max: extremes.maxFrequency }
                    ),
                    duration: getMappingValue(
                        mapping.duration,
                        false,
                        { min: extremes.minDuration, max: extremes.maxDuration }
                    ) as any,
                    pan: getMappingValue(
                        mapping.pan,
                        true,
                        { min: extremes.minPan, max: extremes.maxPan }
                    ),
                    volume: getMappingValue(
                        mapping.volume,
                        true,
                        { min: extremes.minVolume, max: extremes.maxVolume }
                    ),
                    onEnd: onEnd,
                    minFrequency: extremes.minFrequency,
                    maxFrequency: extremes.maxFrequency
                });
            } else {
                error(30);
            }
        });
    }

    /**
     * Cancel sonification of a point. Calls onEnd functions.
     *
     * @requires module:modules/sonification
     *
     * @function Highcharts.Point#cancelSonify
     *
     * @param {boolean} [fadeOut=false]
     *        Whether or not to fade out as we stop. If false, the points are
     *        cancelled synchronously.
     *
     * @return {void}
     */
    function pointCancelSonify(
        this: Highcharts.SonifyablePoint,
        fadeOut?: boolean
    ): void {
        const playing = this.sonification && this.sonification.instrumentsPlaying,
            instrIds = playing && Object.keys(playing);

        if (instrIds && instrIds.length) {
            instrIds.forEach(function (instr: string): void {
                (playing as any)[instr].stop(!fadeOut, null, 'cancelled');
            });
            this.sonification.instrumentsPlaying = {};
            (this.sonification.signalHandler as any).emitSignal(
                'onEnd', 'cancelled'
            );
        }
    }
}

/* *
 *
 *  Default Export
 *
 * */

export default PointSonify;

/* *
 *
 *  API Declarations
 *
 * */

/**
 * Define the parameter mapping for an instrument.
 *
 * @requires module:modules/sonification
 *
 * @interface Highcharts.PointInstrumentMappingObject
 *//**
 * Define the volume of the instrument. This can be a string with a data
 * property name, e.g. `'y'`, in which case this data property is used to define
 * the volume relative to the `y`-values of the other points. A higher `y` value
 * would then result in a higher volume. Alternatively, `'-y'` can be used,
 * which inverts the polarity, so that a higher `y` value results in a lower
 * volume. This option can also be a fixed number or a function. If it is a
 * function, this function is called in regular intervals while the note is
 * playing. It receives three arguments: The point, the dataExtremes, and the
 * current relative time - where 0 is the beginning of the note and 1 is the
 * end. The function should return the volume of the note as a number between
 * 0 and 1.
 * @name Highcharts.PointInstrumentMappingObject#volume
 * @type {string|number|Function}
 *//**
 * Define the duration of the notes for this instrument. This can be a string
 * with a data property name, e.g. `'y'`, in which case this data property is
 * used to define the duration relative to the `y`-values of the other points. A
 * higher `y` value would then result in a longer duration. Alternatively,
 * `'-y'` can be used, in which case the polarity is inverted, and a higher
 * `y` value would result in a shorter duration. This option can also be a
 * fixed number or a function. If it is a function, this function is called
 * once before the note starts playing, and should return the duration in
 * milliseconds. It receives two arguments: The point, and the dataExtremes.
 * @name Highcharts.PointInstrumentMappingObject#duration
 * @type {string|number|Function}
 *//**
 * Define the panning of the instrument. This can be a string with a data
 * property name, e.g. `'x'`, in which case this data property is used to define
 * the panning relative to the `x`-values of the other points. A higher `x`
 * value would then result in a higher panning value (panned further to the
 * right). Alternatively, `'-x'` can be used, in which case the polarity is
 * inverted, and a higher `x` value would result in a lower panning value
 * (panned further to the left). This option can also be a fixed number or a
 * function. If it is a function, this function is called in regular intervals
 * while the note is playing. It receives three arguments: The point, the
 * dataExtremes, and the current relative time - where 0 is the beginning of
 * the note and 1 is the end. The function should return the panning of the
 * note as a number between -1 and 1.
 * @name Highcharts.PointInstrumentMappingObject#pan
 * @type {string|number|Function|undefined}
 *//**
 * Define the frequency of the instrument. This can be a string with a data
 * property name, e.g. `'y'`, in which case this data property is used to define
 * the frequency relative to the `y`-values of the other points. A higher `y`
 * value would then result in a higher frequency. Alternatively, `'-y'` can be
 * used, in which case the polarity is inverted, and a higher `y` value would
 * result in a lower frequency. This option can also be a fixed number or a
 * function. If it is a function, this function is called in regular intervals
 * while the note is playing. It receives three arguments: The point, the
 * dataExtremes, and the current relative time - where 0 is the beginning of
 * the note and 1 is the end. The function should return the frequency of the
 * note as a number (in Hz).
 * @name Highcharts.PointInstrumentMappingObject#frequency
 * @type {string|number|Function}
 */


/**
 * @requires module:modules/sonification
 *
 * @interface Highcharts.PointInstrumentOptionsObject
 *//**
 * The minimum duration for a note when using a data property for duration. Can
 * be overridden by using either a fixed number or a function for
 * instrumentMapping.duration. Defaults to 20.
 * @name Highcharts.PointInstrumentOptionsObject#minDuration
 * @type {number|undefined}
 *//**
 * The maximum duration for a note when using a data property for duration. Can
 * be overridden by using either a fixed number or a function for
 * instrumentMapping.duration. Defaults to 2000.
 * @name Highcharts.PointInstrumentOptionsObject#maxDuration
 * @type {number|undefined}
 *//**
 * The minimum pan value for a note when using a data property for panning. Can
 * be overridden by using either a fixed number or a function for
 * instrumentMapping.pan. Defaults to -1 (fully left).
 * @name Highcharts.PointInstrumentOptionsObject#minPan
 * @type {number|undefined}
 *//**
 * The maximum pan value for a note when using a data property for panning. Can
 * be overridden by using either a fixed number or a function for
 * instrumentMapping.pan. Defaults to 1 (fully right).
 * @name Highcharts.PointInstrumentOptionsObject#maxPan
 * @type {number|undefined}
 *//**
 * The minimum volume for a note when using a data property for volume. Can be
 * overridden by using either a fixed number or a function for
 * instrumentMapping.volume. Defaults to 0.1.
 * @name Highcharts.PointInstrumentOptionsObject#minVolume
 * @type {number|undefined}
 *//**
 * The maximum volume for a note when using a data property for volume. Can be
 * overridden by using either a fixed number or a function for
 * instrumentMapping.volume. Defaults to 1.
 * @name Highcharts.PointInstrumentOptionsObject#maxVolume
 * @type {number|undefined}
 *//**
 * The minimum frequency for a note when using a data property for frequency.
 * Can be overridden by using either a fixed number or a function for
 * instrumentMapping.frequency. Defaults to 220.
 * @name Highcharts.PointInstrumentOptionsObject#minFrequency
 * @type {number|undefined}
 *//**
 * The maximum frequency for a note when using a data property for frequency.
 * Can be overridden by using either a fixed number or a function for
 * instrumentMapping.frequency. Defaults to 2200.
 * @name Highcharts.PointInstrumentOptionsObject#maxFrequency
 * @type {number|undefined}
 */


/**
 * An instrument definition for a point, specifying the instrument to play and
 * how to play it.
 *
 * @interface Highcharts.PointInstrumentObject
 *//**
 * An Instrument instance or the name of the instrument in the
 * Highcharts.sonification.instruments map.
 * @name Highcharts.PointInstrumentObject#instrument
 * @type {Highcharts.Instrument|string}
 *//**
 * Mapping of instrument parameters for this instrument.
 * @name Highcharts.PointInstrumentObject#instrumentMapping
 * @type {Highcharts.PointInstrumentMappingObject}
 *//**
 * Options for this instrument.
 * @name Highcharts.PointInstrumentObject#instrumentOptions
 * @type {Highcharts.PointInstrumentOptionsObject|undefined}
 *//**
 * Callback to call when the instrument has stopped playing.
 * @name Highcharts.PointInstrumentObject#onEnd
 * @type {Function|undefined}
 */


/**
 * Options for sonifying a point.
 * @interface Highcharts.PointSonifyOptionsObject
 *//**
 * The instrument definitions for this point.
 * @name Highcharts.PointSonifyOptionsObject#instruments
 * @type {Array<Highcharts.PointInstrumentObject>}
 *//**
 * Optionally provide the minimum/maximum values for the points. If this is not
 * supplied, it is calculated from the points in the chart on demand. This
 * option is supplied in the following format, as a map of point data properties
 * to objects with min/max values:
 *  ```js
 *      dataExtremes: {
 *          y: {
 *              min: 0,
 *              max: 100
 *          },
 *          z: {
 *              min: -10,
 *              max: 10
 *          }
 *          // Properties used and not provided are calculated on demand
 *      }
 *  ```
 * @name Highcharts.PointSonifyOptionsObject#dataExtremes
 * @type {object|undefined}
 *//**
 * Callback called when the sonification has finished.
 * @name Highcharts.PointSonifyOptionsObject#onEnd
 * @type {Function|undefined}
 */
(''); // detach doclets above
