/* *
 *
 *  (c) 2009-2021 Øystein Moseng
 *
 *  Handle forcing series markers.
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

import type {
    PointMarkerOptions,
    PointOptions
} from '../../../Core/Series/PointOptions';
import type SeriesOptions from '../../../Core/Series/SeriesOptions';
import Series from '../../../Core/Series/Series.js';
import U from '../../../Core/Utilities.js';
const {
    addEvent,
    merge
} = U;

/* *
 *
 *  Declarations
 *
 * */

declare module '../../../Core/Series/PointLike' {
    interface PointLike {
        hasForcedA11yMarker?: boolean;
    }
}

declare module '../../../Core/Series/SeriesLike' {
    interface SeriesLike {
        a11yMarkersForced?: boolean;
        resetA11yMarkerOptions?: PointMarkerOptions;
        resetMarkerOptions?: unknown;
    }
}


/* eslint-disable no-invalid-this, valid-jsdoc */


/**
 * @private
 */
function isWithinDescriptionThreshold(
    series: Highcharts.AccessibilitySeries
): boolean {
    const a11yOptions = series.chart.options.accessibility;

    return series.points.length <
        (a11yOptions.series as any).pointDescriptionEnabledThreshold ||
        (a11yOptions.series as any).pointDescriptionEnabledThreshold === false;
}


/**
 * @private
 */
function shouldForceMarkers(
    series: Highcharts.AccessibilitySeries
): boolean {
    const chart = series.chart,
        chartA11yEnabled = chart.options.accessibility.enabled,
        seriesA11yEnabled = (series.options.accessibility &&
            series.options.accessibility.enabled) !== false;

    return chartA11yEnabled && seriesA11yEnabled && isWithinDescriptionThreshold(series);
}


/**
 * @private
 */
function hasIndividualPointMarkerOptions(series: Series): boolean {
    return !!(series._hasPointMarkers && series.points && series.points.length);
}


/**
 * @private
 */
function unforceSeriesMarkerOptions(series: Highcharts.AccessibilitySeries): void {
    const resetMarkerOptions = series.resetA11yMarkerOptions;

    if (resetMarkerOptions) {
        merge(true, series.options, {
            marker: {
                enabled: resetMarkerOptions.enabled,
                states: {
                    normal: {
                        opacity: resetMarkerOptions.states &&
                            resetMarkerOptions.states.normal &&
                            resetMarkerOptions.states.normal.opacity
                    }
                }
            }
        });
    }
}


/**
 * @private
 */
function forceZeroOpacityMarkerOptions(
    options: (PointOptions|SeriesOptions)
): void {
    merge(true, options, {
        marker: {
            enabled: true,
            states: {
                normal: {
                    opacity: 0
                }
            }
        }
    });
}


/**
 * @private
 */
function getPointMarkerOpacity(pointOptions: PointOptions): number|undefined {
    return (pointOptions.marker as any).states &&
        (pointOptions.marker as any).states.normal &&
        (pointOptions.marker as any).states.normal.opacity;
}


/**
 * @private
 */
function unforcePointMarkerOptions(pointOptions: PointOptions): void {
    merge(true, pointOptions.marker, {
        states: {
            normal: {
                opacity: getPointMarkerOpacity(pointOptions) || 1
            }
        }
    });
}


/**
 * @private
 */
function handleForcePointMarkers(series: Series): void {
    let i = series.points.length;

    while (i--) {
        const point = series.points[i];
        const pointOptions = point.options;
        const hadForcedMarker = point.hasForcedA11yMarker;
        delete point.hasForcedA11yMarker;

        if (pointOptions.marker) {
            const isStillForcedMarker = hadForcedMarker && getPointMarkerOpacity(pointOptions) === 0;

            if (pointOptions.marker.enabled && !isStillForcedMarker) {
                unforcePointMarkerOptions(pointOptions);
                point.hasForcedA11yMarker = false;
            } else if (pointOptions.marker.enabled === false) {
                forceZeroOpacityMarkerOptions(pointOptions);
                point.hasForcedA11yMarker = true;
            }
        }
    }
}


/**
 * @private
 */
function addForceMarkersEvents(): void {

    /**
     * Keep track of forcing markers.
     * @private
     */
    addEvent(Series, 'render', function (): void {
        const series = this as Highcharts.AccessibilitySeries,
            options = series.options;

        if (shouldForceMarkers(series)) {
            if (options.marker && options.marker.enabled === false) {
                series.a11yMarkersForced = true;
                forceZeroOpacityMarkerOptions(series.options);
            }

            if (hasIndividualPointMarkerOptions(series)) {
                handleForcePointMarkers(series);
            }

        } else if (series.a11yMarkersForced) {
            delete series.a11yMarkersForced;
            unforceSeriesMarkerOptions(series);
        }
    });


    /**
     * Keep track of options to reset markers to if no longer forced.
     * @private
     */
    addEvent(Series, 'afterSetOptions', function (
        e: { options: SeriesOptions }
    ): void {
        this.resetA11yMarkerOptions = merge(
            e.options.marker || {}, this.userOptions.marker || {}
        );
    });


    /**
     * Process marker graphics after render
     * @private
     */
    addEvent(Series as any, 'afterRender', function (
        this: Highcharts.AccessibilitySeries
    ): void {
        const series = this;

        // For styled mode the rendered graphic does not reflect the style
        // options, and we need to add/remove classes to achieve the same.
        if (series.chart.styledMode) {
            if (series.markerGroup) {
                series.markerGroup[
                    series.a11yMarkersForced ? 'addClass' : 'removeClass'
                ]('highcharts-a11y-markers-hidden');
            }

            // Do we need to handle individual points?
            if (hasIndividualPointMarkerOptions(series)) {
                series.points.forEach((point): void => {
                    if (point.graphic) {
                        point.graphic[
                            point.hasForcedA11yMarker ? 'addClass' : 'removeClass'
                        ]('highcharts-a11y-marker-hidden');
                        point.graphic[
                            point.hasForcedA11yMarker === false ? 'addClass' : 'removeClass'
                        ]('highcharts-a11y-marker-visible');
                    }
                });
            }
        }
    });

}

export default addForceMarkersEvents;
