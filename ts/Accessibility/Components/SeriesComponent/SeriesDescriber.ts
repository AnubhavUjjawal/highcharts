/* *
 *
 *  (c) 2009-2021 Øystein Moseng
 *
 *  Place desriptions on a series and its points.
 *
 *  License: www.highcharts.com/license
 *
 *  !!!!!!! SOURCE GETS TRANSPILED BY TYPESCRIPT. EDIT TS FILE ONLY. !!!!!!!
 *
 * */

'use strict';

import type Axis from '../../../Core/Axis/Axis';
import type { DOMElementType } from '../../../Core/Renderer/DOMElementType';
import type Point from '../../../Core/Series/Point';
import type PositionObject from '../../../Core/Renderer/PositionObject';
import type Series from '../../../Core/Series/Series';
import type SVGElement from '../../../Core/Renderer/SVG/SVGElement';

import AnnotationsA11y from '../AnnotationsA11y.js';
const {
    getPointAnnotationTexts
} = AnnotationsA11y;
import ChartUtilities from '../../Utils/ChartUtilities.js';
const {
    getAxisDescription,
    getSeriesFirstPointElement,
    getSeriesA11yElement,
    unhideChartElementFromAT
} = ChartUtilities;
import F from '../../../Core/FormatUtilities.js';
const {
    format,
    numberFormat
} = F;
import HTMLUtilities from '../../Utils/HTMLUtilities.js';
const {
    reverseChildNodes,
    stripHTMLTagsFromString: stripHTMLTags
} = HTMLUtilities;
import Tooltip from '../../../Core/Tooltip.js';
import U from '../../../Core/Utilities.js';
const {
    find,
    isNumber,
    pick,
    defined
} = U;

declare module '../../../Core/Series/PointLike' {
    interface PointLike {
        /** @requires modules/accessibility */
        hasDummyGraphic?: boolean;
    }
}

/**
 * Internal types.
 * @private
 */
declare global {
    namespace Highcharts {
        interface AccessibilityPoint {
            accessibility?: AccessibilityPointStateObject;
            value?: (number|null);
        }
        interface AccessibilityPointStateObject {
            valueDescription?: string;
        }
    }
}

/* eslint-disable valid-jsdoc */

/**
 * @private
 */
function findFirstPointWithGraphic(
    point: Point
): (Point|null) {
    const sourcePointIndex = point.index;

    if (!point.series || !point.series.data || !defined(sourcePointIndex)) {
        return null;
    }

    return find(point.series.data, function (p: Point): boolean {
        return !!(
            p &&
            typeof p.index !== 'undefined' &&
            p.index > sourcePointIndex &&
            p.graphic &&
            p.graphic.element
        );
    }) || null;
}


/**
 * @private
 */
function shouldAddDummyPoint(point: Point): boolean {
    // Note: Sunburst series use isNull for hidden points on drilldown.
    // Ignore these.
    const isSunburst = point.series && point.series.is('sunburst'),
        isNull = point.isNull;

    return isNull && !isSunburst;
}


/**
 * @private
 */
function makeDummyElement(
    point: Point,
    pos: PositionObject
): SVGElement {
    const renderer = point.series.chart.renderer,
        dummy = renderer.rect(pos.x, pos.y, 1, 1);

    dummy.attr({
        'class': 'highcharts-a11y-dummy-point',
        fill: 'none',
        opacity: 0,
        'fill-opacity': 0,
        'stroke-opacity': 0
    });

    return dummy;
}


/**
 * @private
 * @param {Highcharts.Point} point
 * @return {Highcharts.HTMLDOMElement|Highcharts.SVGDOMElement|undefined}
 */
function addDummyPointElement(
    point: Point
): (DOMElementType|undefined) {
    const series = point.series,
        firstPointWithGraphic = findFirstPointWithGraphic(point),
        firstGraphic = firstPointWithGraphic && firstPointWithGraphic.graphic,
        parentGroup = firstGraphic ?
            firstGraphic.parentGroup :
            series.graph || series.group,
        dummyPos = firstPointWithGraphic ? {
            x: pick(point.plotX, firstPointWithGraphic.plotX, 0),
            y: pick(point.plotY, firstPointWithGraphic.plotY, 0)
        } : {
            x: pick(point.plotX, 0),
            y: pick(point.plotY, 0)
        },
        dummyElement = makeDummyElement(point, dummyPos);

    if (parentGroup && parentGroup.element) {
        point.graphic = dummyElement;
        point.hasDummyGraphic = true;

        dummyElement.add(parentGroup);

        // Move to correct pos in DOM
        parentGroup.element.insertBefore(
            dummyElement.element,
            firstGraphic ? firstGraphic.element : null
        );

        return dummyElement.element;
    }
}


/**
 * @private
 * @param {Highcharts.Series} series
 * @return {boolean}
 */
function hasMorePointsThanDescriptionThreshold(
    series: Highcharts.AccessibilitySeries
): boolean {
    const chartA11yOptions = series.chart.options.accessibility,
        threshold: (boolean|number) = (
            (chartA11yOptions.series as any).pointDescriptionEnabledThreshold
        );

    return !!(
        threshold !== false &&
        series.points &&
        series.points.length >= threshold
    );
}


/**
 * @private
 * @param {Highcharts.Series} series
 * @return {boolean}
 */
function shouldSetScreenReaderPropsOnPoints(
    series: Highcharts.AccessibilitySeries
): boolean {
    const seriesA11yOptions = series.options.accessibility || {};

    return !hasMorePointsThanDescriptionThreshold(series) &&
        !seriesA11yOptions.exposeAsGroupOnly;
}


/**
 * @private
 * @param {Highcharts.Series} series
 * @return {boolean}
 */
function shouldSetKeyboardNavPropsOnPoints(
    series: Highcharts.AccessibilitySeries
): boolean {
    const chartA11yOptions = series.chart.options.accessibility,
        seriesNavOptions = chartA11yOptions.keyboardNavigation.seriesNavigation;

    return !!(
        series.points && (
            series.points.length <
                seriesNavOptions.pointNavigationEnabledThreshold ||
            seriesNavOptions.pointNavigationEnabledThreshold === false
        )
    );
}


/**
 * @private
 * @param {Highcharts.Series} series
 * @return {boolean}
 */
function shouldDescribeSeriesElement(
    series: Highcharts.AccessibilitySeries
): boolean {
    const chart = series.chart,
        chartOptions = chart.options.chart,
        chartHas3d = chartOptions.options3d && chartOptions.options3d.enabled,
        hasMultipleSeries = chart.series.length > 1,
        describeSingleSeriesOption =
            (chart.options.accessibility.series as any).describeSingleSeries,
        exposeAsGroupOnlyOption =
            (series.options.accessibility || {}).exposeAsGroupOnly,
        noDescribe3D = chartHas3d && hasMultipleSeries;

    return !noDescribe3D && (
        hasMultipleSeries || describeSingleSeriesOption ||
        exposeAsGroupOnlyOption || hasMorePointsThanDescriptionThreshold(series)
    );
}


/**
 * @private
 * @param {Highcharts.Point} point
 * @param {number} value
 * @return {string}
 */
function pointNumberToString(
    point: Highcharts.AccessibilityPoint,
    value: number
): string {
    const series = point.series,
        chart = series.chart,
        a11yPointOptions = chart.options.accessibility.point || {},
        seriesA11yPointOptions = series.options.accessibility && series.options.accessibility.point || {},
        tooltipOptions = series.tooltipOptions || {},
        lang = chart.options.lang;

    if (isNumber(value)) {
        return numberFormat(
            value,
            seriesA11yPointOptions.valueDecimals ||
                a11yPointOptions.valueDecimals ||
                tooltipOptions.valueDecimals ||
                -1,
            lang.decimalPoint,
            (lang.accessibility as any).thousandsSep || lang.thousandsSep
        );
    }

    return value;
}


/**
 * @private
 * @param {Highcharts.Series} series
 * @return {string}
 */
function getSeriesDescriptionText(
    series: Highcharts.AccessibilitySeries
): string {
    const seriesA11yOptions = series.options.accessibility || {},
        descOpt = seriesA11yOptions.description;

    return descOpt && series.chart.langFormat(
        'accessibility.series.description', {
            description: descOpt,
            series: series
        }
    ) || '';
}


/**
 * @private
 * @param {Highcharts.series} series
 * @param {string} axisCollection
 * @return {string}
 */
function getSeriesAxisDescriptionText(
    series: Series,
    axisCollection: string
): string {
    const axis: Axis = (series as any)[axisCollection];

    return series.chart.langFormat(
        'accessibility.series.' + axisCollection + 'Description',
        {
            name: getAxisDescription(axis),
            series: series
        }
    );
}


/**
 * Get accessible time description for a point on a datetime axis.
 *
 * @private
 * @function Highcharts.Point#getTimeDescription
 * @param {Highcharts.Point} point
 * @return {string|undefined}
 * The description as string.
 */
function getPointA11yTimeDescription(
    point: Highcharts.AccessibilityPoint
): (string|undefined) {
    const series = point.series,
        chart = series.chart,
        seriesA11yOptions = series.options.accessibility && series.options.accessibility.point || {},
        a11yOptions = chart.options.accessibility.point || {},
        dateXAxis = series.xAxis && series.xAxis.dateTime;

    if (dateXAxis) {
        const tooltipDateFormat = dateXAxis.getXDateFormat(
                point.x || 0,
                chart.options.tooltip.dateTimeLabelFormats
            ),
            dateFormat = seriesA11yOptions.dateFormatter && seriesA11yOptions.dateFormatter(point) ||
                a11yOptions.dateFormatter && a11yOptions.dateFormatter(point) ||
                seriesA11yOptions.dateFormat ||
                a11yOptions.dateFormat ||
                tooltipDateFormat;

        return chart.time.dateFormat(dateFormat, point.x || 0, void 0);
    }
}


/**
 * @private
 * @param {Highcharts.Point} point
 * @return {string}
 */
function getPointXDescription(
    point: Highcharts.AccessibilityPoint
): string {
    const timeDesc = getPointA11yTimeDescription(point),
        xAxis = point.series.xAxis || {},
        pointCategory = xAxis.categories && defined(point.category) &&
            ('' + point.category).replace('<br/>', ' '),
        canUseId = point.id && point.id.indexOf('highcharts-') < 0,
        fallback = 'x, ' + point.x;

    return point.name || timeDesc || pointCategory ||
        (canUseId ? point.id : fallback);
}


/**
 * @private
 * @param {Highcharts.Point} point
 * @param {string} prefix
 * @param {string} suffix
 * @return {string}
 */
function getPointArrayMapValueDescription(
    point: Highcharts.AccessibilityPoint,
    prefix: string,
    suffix: string
): string {
    const pre = prefix || '',
        suf = suffix || '',
        keyToValStr = function (key: string): string {
            const num = pointNumberToString(
                point,
                pick((point as any)[key], (point.options as any)[key])
            );
            return key + ': ' + pre + num + suf;
        },
        pointArrayMap: Array<string> = point.series.pointArrayMap as any;

    return pointArrayMap.reduce(function (desc: string, key: string): string {
        return desc + (desc.length ? ', ' : '') + keyToValStr(key);
    }, '');
}


/**
 * @private
 * @param {Highcharts.Point} point
 * @return {string}
 */
function getPointValue(
    point: Highcharts.AccessibilityPoint
): string {
    const series = point.series,
        a11yPointOpts = series.chart.options.accessibility.point || {},
        seriesA11yPointOpts = series.chart.options.accessibility && series.chart.options.accessibility.point || {},
        tooltipOptions = series.tooltipOptions || {},
        valuePrefix = seriesA11yPointOpts.valuePrefix ||
            a11yPointOpts.valuePrefix ||
            tooltipOptions.valuePrefix ||
            '',
        valueSuffix = seriesA11yPointOpts.valueSuffix ||
            a11yPointOpts.valueSuffix ||
            tooltipOptions.valueSuffix ||
            '',
        fallbackKey: ('value'|'y') = (
            typeof point.value !==
            'undefined' ?
                'value' : 'y'
        ),
        fallbackDesc = pointNumberToString(point, (point as any)[fallbackKey]);

    if (point.isNull) {
        return series.chart.langFormat('accessibility.series.nullPointValue', {
            point: point
        });
    }

    if (series.pointArrayMap) {
        return getPointArrayMapValueDescription(
            point, valuePrefix, valueSuffix
        );
    }

    return valuePrefix + fallbackDesc + valueSuffix;
}


/**
 * Return the description for the annotation(s) connected to a point, or empty
 * string if none.
 *
 * @private
 * @param {Highcharts.Point} point The data point to get the annotation info from.
 * @return {string} Annotation description
 */
function getPointAnnotationDescription(point: Point): string {
    const chart = point.series.chart;
    const langKey = 'accessibility.series.pointAnnotationsDescription';
    const annotations = getPointAnnotationTexts(point as Highcharts.AnnotationPoint);
    const context = { point, annotations };

    return annotations.length ? chart.langFormat(langKey, context) : '';
}


/**
 * Return string with information about point.
 * @private
 * @return {string}
 */
function getPointValueDescription(point: Highcharts.AccessibilityPoint): string {
    const series = point.series,
        chart = series.chart,
        seriesA11yOptions = series.options.accessibility,
        seriesValueDescFormat = seriesA11yOptions && seriesA11yOptions.point &&
            seriesA11yOptions.point.valueDescriptionFormat,
        pointValueDescriptionFormat = seriesValueDescFormat ||
            chart.options.accessibility.point.valueDescriptionFormat,
        showXDescription = pick(
            series.xAxis &&
            series.xAxis.options.accessibility &&
            series.xAxis.options.accessibility.enabled,
            !chart.angular
        ),
        xDesc = showXDescription ? getPointXDescription(point) : '',
        context = {
            point: point,
            index: defined(point.index) ? (point.index + 1) : '',
            xDescription: xDesc,
            value: getPointValue(point),
            separator: showXDescription ? ', ' : ''
        };

    return format(pointValueDescriptionFormat, context, chart);
}


/**
 * Return string with information about point.
 * @private
 * @return {string}
 */
function defaultPointDescriptionFormatter(
    point: Highcharts.AccessibilityPoint
): string {
    const series = point.series,
        chart = series.chart,
        valText = getPointValueDescription(point),
        description = point.options && point.options.accessibility &&
            point.options.accessibility.description,
        userDescText = description ? ' ' + description : '',
        seriesNameText = chart.series.length > 1 && series.name ?
            ' ' + series.name + '.' : '',
        annotationsDesc = getPointAnnotationDescription(point),
        pointAnnotationsText = annotationsDesc ? ' ' + annotationsDesc : '';

    point.accessibility = point.accessibility || {};
    point.accessibility.valueDescription = valText;

    return valText + userDescText + seriesNameText + pointAnnotationsText;
}


/**
 * Set a11y props on a point element
 * @private
 * @param {Highcharts.Point} point
 * @param {Highcharts.HTMLDOMElement|Highcharts.SVGDOMElement} pointElement
 */
function setPointScreenReaderAttribs(
    point: Highcharts.AccessibilityPoint,
    pointElement: DOMElementType
): void {
    const series = point.series,
        a11yPointOptions = series.chart.options.accessibility.point || {},
        seriesPointA11yOptions = series.options.accessibility && series.options.accessibility.point || {},
        label = stripHTMLTags(
            seriesPointA11yOptions.descriptionFormatter &&
            seriesPointA11yOptions.descriptionFormatter(point) ||
            a11yPointOptions.descriptionFormatter &&
            a11yPointOptions.descriptionFormatter(point) ||
            defaultPointDescriptionFormatter(point)
        );

    pointElement.setAttribute('role', 'img');
    pointElement.setAttribute('aria-label', label);
}


/**
 * Add accessible info to individual point elements of a series
 * @private
 * @param {Highcharts.Series} series
 */
function describePointsInSeries(series: Highcharts.AccessibilitySeries): void {
    const setScreenReaderProps = shouldSetScreenReaderPropsOnPoints(series),
        setKeyboardProps = shouldSetKeyboardNavPropsOnPoints(series);

    if (setScreenReaderProps || setKeyboardProps) {
        series.points.forEach(function (
            point: Highcharts.AccessibilityPoint
        ): void {
            const pointEl = point.graphic && point.graphic.element ||
                    shouldAddDummyPoint(point) && addDummyPointElement(point);
            const pointA11yDisabled = (
                point.options &&
                point.options.accessibility &&
                point.options.accessibility.enabled === false
            );

            if (pointEl) {
                // We always set tabindex, as long as we are setting props.
                // When setting tabindex, also remove default outline to
                // avoid ugly border on click.
                pointEl.setAttribute('tabindex', '-1');
                if (!series.chart.styledMode) {
                    pointEl.style.outline = 'none';
                }

                if (setScreenReaderProps && !pointA11yDisabled) {
                    setPointScreenReaderAttribs(point, pointEl);
                } else {
                    pointEl.setAttribute('aria-hidden', true);
                }
            }
        });
    }
}


/**
 * Return string with information about series.
 * @private
 * @return {string}
 */
function defaultSeriesDescriptionFormatter(
    series: Highcharts.AccessibilitySeries
): string {
    const chart = series.chart,
        chartTypes = chart.types || [],
        description = getSeriesDescriptionText(series),
        shouldDescribeAxis = function (
            coll: ('xAxis'|'yAxis')
        ): (boolean|Axis) {
            return chart[coll] && chart[coll].length > 1 && series[coll];
        },
        xAxisInfo = getSeriesAxisDescriptionText(series, 'xAxis'),
        yAxisInfo = getSeriesAxisDescriptionText(series, 'yAxis'),
        summaryContext = {
            name: series.name || '',
            ix: (series.index as any) + 1,
            numSeries: chart.series && chart.series.length,
            numPoints: series.points && series.points.length,
            series: series
        },
        combinationSuffix = chartTypes.length > 1 ? 'Combination' : '',
        summary = chart.langFormat(
            'accessibility.series.summary.' + series.type + combinationSuffix,
            summaryContext
        ) || chart.langFormat(
            'accessibility.series.summary.default' + combinationSuffix,
            summaryContext
        );

    return summary + (description ? ' ' + description : '') + (
        shouldDescribeAxis('yAxis') ? ' ' + yAxisInfo : ''
    ) + (
        shouldDescribeAxis('xAxis') ? ' ' + xAxisInfo : ''
    );
}


/**
 * Set a11y props on a series element
 * @private
 * @param {Highcharts.Series} series
 * @param {Highcharts.HTMLDOMElement|Highcharts.SVGDOMElement} seriesElement
 */
function describeSeriesElement(
    series: Highcharts.AccessibilitySeries,
    seriesElement: DOMElementType
): void {
    const seriesA11yOptions = series.options.accessibility || {},
        a11yOptions = series.chart.options.accessibility,
        landmarkVerbosity = a11yOptions.landmarkVerbosity;

    // Handle role attribute
    if (seriesA11yOptions.exposeAsGroupOnly) {
        seriesElement.setAttribute('role', 'img');
    } else if (landmarkVerbosity === 'all') {
        seriesElement.setAttribute('role', 'region');
    } /* else do not add role */

    seriesElement.setAttribute('tabindex', '-1');
    if (!series.chart.styledMode) {
        seriesElement.style.outline = 'none'; // Don't show browser outline on click, despite tabindex
    }
    seriesElement.setAttribute(
        'aria-label',
        stripHTMLTags(
            (a11yOptions.series as any).descriptionFormatter &&
            (a11yOptions.series as any).descriptionFormatter(series) ||
            defaultSeriesDescriptionFormatter(series)
        )
    );
}


/**
 * Put accessible info on series and points of a series.
 * @param {Highcharts.Series} series The series to add info on.
 */
function describeSeries(series: Highcharts.AccessibilitySeries): void {
    const chart = series.chart,
        firstPointEl = getSeriesFirstPointElement(series),
        seriesEl = getSeriesA11yElement(series),
        is3d = chart.is3d && chart.is3d();

    if (seriesEl) {
        // For some series types the order of elements do not match the
        // order of points in series. In that case we have to reverse them
        // in order for AT to read them out in an understandable order.
        // Due to z-index issues we can not do this for 3D charts.
        if (seriesEl.lastChild === firstPointEl && !is3d) {
            reverseChildNodes(seriesEl);
        }

        describePointsInSeries(series);

        unhideChartElementFromAT(chart, seriesEl);

        if (shouldDescribeSeriesElement(series)) {
            describeSeriesElement(series, seriesEl);
        } else {
            seriesEl.setAttribute('aria-label', '');
        }
    }
}


const SeriesDescriber = {
    describeSeries,
    defaultPointDescriptionFormatter,
    defaultSeriesDescriptionFormatter,
    getPointA11yTimeDescription,
    getPointXDescription,
    getPointValue,
    getPointValueDescription
};

export default SeriesDescriber;
