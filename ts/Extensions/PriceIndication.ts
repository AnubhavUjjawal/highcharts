/**
 * (c) 2009-2021 Sebastian Bochann
 *
 * Price indicator for Highcharts
 *
 * License: www.highcharts.com/license
 *
 *  !!!!!!! SOURCE GETS TRANSPILED BY TYPESCRIPT. EDIT TS FILE ONLY. !!!!!!!
 */

'use strict';

import type SVGElement from '../Core/Renderer/SVG/SVGElement';
import Series from '../Core/Series/Series.js';
import U from '../Core/Utilities.js';
const {
    addEvent,
    isArray,
    merge
} = U;

declare module '../Core/Series/SeriesLike' {
    interface SeriesLike {
        lastPrice?: SVGElement;
        lastVisiblePrice?: SVGElement;
        crossLabel?: SVGElement;
    }

}

declare module '../Core/Series/SeriesOptions' {
    interface SeriesOptions {
        lastPrice?: Highcharts.LastPriceOptions;
        lastVisiblePrice?: Highcharts.LastVisiblePriceOptions;
    }
}

declare global {
    namespace Highcharts {
        interface LastPriceOptions extends XAxisCrosshairOptions {
            enabled?: boolean;
        }
        interface LastVisiblePriceOptions {
            enabled?: boolean;
            label?: LastVisiblePriceLabelOptions;
        }
        interface LastVisiblePriceLabelOptions {
            enabled: true;
        }
    }
}

/**
 * The line marks the last price from visible range of points.
 *
 * @sample {highstock} stock/indicators/last-visible-price
 *         Last visible price
 *
 * @declare   Highcharts.SeriesLastVisiblePriceOptionsObject
 * @product   highstock
 * @requires  modules/price-indicator
 * @apioption plotOptions.series.lastVisiblePrice
 */

/**
 * Enable or disable the indicator.
 *
 * @type      {boolean}
 * @product   highstock
 * @default   true
 * @apioption plotOptions.series.lastVisiblePrice.enabled
 */

/**
 * @declare   Highcharts.SeriesLastVisiblePriceLabelOptionsObject
 * @apioption plotOptions.series.lastVisiblePrice.label
 */

/**
 * Enable or disable the label.
 *
 * @type      {boolean}
 * @product   highstock
 * @default   true
 * @apioption plotOptions.series.lastVisiblePrice.label.enabled
 *
 */

/**
 * The line marks the last price from all points.
 *
 * @sample {highstock} stock/indicators/last-price
 *         Last price
 *
 * @declare   Highcharts.SeriesLastPriceOptionsObject
 * @product   highstock
 * @requires  modules/price-indicator
 * @apioption plotOptions.series.lastPrice
 */

/**
 * Enable or disable the indicator.
 *
 * @type      {boolean}
 * @product   highstock
 * @default   true
 * @apioption plotOptions.series.lastPrice.enabled
 */

/**
 * The color of the line of last price.
 *
 * @type      {string}
 * @product   highstock
 * @default   red
 * @apioption plotOptions.series.lastPrice.color
 *
 */

/* eslint-disable no-invalid-this */

addEvent(Series, 'afterRender', function (): void {
    var serie = this,
        seriesOptions = serie.options,
        pointRange = seriesOptions.pointRange,
        lastVisiblePrice = seriesOptions.lastVisiblePrice,
        lastPrice = seriesOptions.lastPrice;

    if ((lastVisiblePrice || lastPrice) &&
            seriesOptions.id !== 'highcharts-navigator-series') {

        var xAxis = serie.xAxis,
            yAxis = serie.yAxis,
            origOptions = yAxis.crosshair,
            origGraphic = yAxis.cross,
            origLabel = yAxis.crossLabel,
            points = serie.points,
            yLength = (serie.yData as any).length,
            pLength = points.length,
            x = (serie.xData as any)[(serie.xData as any).length - 1],
            y = (serie.yData as any)[yLength - 1],
            lastPoint,
            yValue,
            crop;

        if (lastPrice && lastPrice.enabled) {

            yAxis.crosshair = yAxis.options.crosshair = seriesOptions.lastPrice;

            yAxis.cross = serie.lastPrice;
            yValue = isArray(y) ? y[3] : y;

            yAxis.drawCrosshair((null as any), ({
                x: x,
                y: yValue,
                plotX: xAxis.toPixels(x, true),
                plotY: yAxis.toPixels(yValue, true)
            }) as any);

            // Save price
            if (serie.yAxis.cross) {
                serie.lastPrice = serie.yAxis.cross;
                serie.lastPrice.y = yValue;
            }
        }

        if (lastVisiblePrice &&
            lastVisiblePrice.enabled &&
            pLength > 0
        ) {

            crop = (points[pLength - 1].x === x) || pointRange === null ? 1 : 2;

            yAxis.crosshair = yAxis.options.crosshair = merge({
                color: 'transparent'
            }, seriesOptions.lastVisiblePrice);

            yAxis.cross = serie.lastVisiblePrice;
            lastPoint = points[pLength - crop];

            if (serie.crossLabel) {
                // Set to undefined to avoid collision with
                // the yAxis crosshair #11480
                serie.crossLabel.destroy();
            }
            delete yAxis.crossLabel;

            // Save price
            yAxis.drawCrosshair((null as any), lastPoint);

            if (yAxis.cross) {
                serie.lastVisiblePrice = yAxis.cross;
                if (typeof lastPoint.y === 'number') {
                    serie.lastVisiblePrice.y = lastPoint.y;
                }
            }

            serie.crossLabel = yAxis.crossLabel;
        }

        // Restore crosshair:
        yAxis.crosshair = yAxis.options.crosshair = origOptions;
        yAxis.cross = origGraphic;
        yAxis.crossLabel = origLabel;

    }
});

/* eslint-enable no-invalid-this */
