/* *
 *
 *  (c) 2010-2021 Torstein Honsi
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

import type Axis from './Axis';
import type Scrollbar from '../Scrollbar';
import type ScrollbarOptions from '../ScrollbarOptions';

import U from '../Utilities.js';
const {
    addEvent,
    defined,
    pick
} = U;

/* *
 *
 *  Declarations
 *
 * */

declare module './AxisComposition' {
    interface AxisComposition {
        scrollbar?: ScrollbarAxis['scrollbar'];
    }
}

declare module './AxisType' {
    interface AxisTypeRegistry {
        ScrollbarAxis: ScrollbarAxis;
    }
}

/* *
 *
 *  Composition
 *
 * */

/* eslint-disable no-invalid-this, valid-jsdoc */

/**
 * Creates scrollbars if enabled.
 * @private
 */
class ScrollbarAxis {
    private static composed: Array<typeof Axis> = [];

    /**
     * Attaches to axis events to create scrollbars if enabled.
     *
     * @private
     *
     * @param AxisClass
     * Axis class to extend.
     *
     * @param ScrollbarClass
     * Scrollbar class to use.
     */
    public static compose<T extends typeof Axis>(AxisClass: T, ScrollbarClass: typeof Scrollbar): (T&ScrollbarAxis) {
        if (ScrollbarAxis.composed.indexOf(AxisClass) === -1) {
            ScrollbarAxis.composed.push(AxisClass);
        } else {
            return AxisClass as (T&ScrollbarAxis);
        }

        const getExtremes = (axis: ScrollbarAxis): Record<string, number> => {
            const axisMin = pick(
                axis.options && axis.options.min,
                axis.min as any
            );
            const axisMax = pick(
                axis.options && axis.options.max,
                axis.max as any
            );
            return {
                axisMin,
                axisMax,
                scrollMin: defined(axis.dataMin) ?
                    Math.min(
                        axisMin,
                        axis.min as any,
                        axis.dataMin,
                        pick(axis.threshold, Infinity)
                    ) : axisMin,
                scrollMax: defined(axis.dataMax) ?
                    Math.max(
                        axisMax,
                        axis.max as any,
                        axis.dataMax,
                        pick(axis.threshold, -Infinity)
                    ) : axisMax
            };
        };

        // Wrap axis initialization and create scrollbar if enabled:
        addEvent(AxisClass, 'afterInit', function (): void {
            const axis = this as ScrollbarAxis;

            if (
                axis.options &&
                axis.options.scrollbar &&
                axis.options.scrollbar.enabled
            ) {
                // Predefined options:
                axis.options.scrollbar.vertical = !axis.horiz;
                axis.options.startOnTick = axis.options.endOnTick = false;

                axis.scrollbar = new ScrollbarClass(
                    axis.chart.renderer,
                    axis.options.scrollbar,
                    axis.chart
                );

                addEvent(axis.scrollbar, 'changed', function (
                    e: Scrollbar.ChangedEvent
                ): void {
                    let {
                            axisMin,
                            axisMax,
                            scrollMin: unitedMin,
                            scrollMax: unitedMax
                        } = getExtremes(axis),
                        range = unitedMax - unitedMin,
                        to,
                        from;

                    // #12834, scroll when show/hide series, wrong extremes
                    if (!defined(axisMin) || !defined(axisMax)) {
                        return;
                    }

                    if (
                        (axis.horiz && !axis.reversed) ||
                        (!axis.horiz && axis.reversed)
                    ) {
                        to = unitedMin + range * (this.to as any);
                        from = unitedMin + range * (this.from as any);
                    } else {
                        // y-values in browser are reversed, but this also
                        // applies for reversed horizontal axis:
                        to = unitedMin + range * (1 - (this.from as any));
                        from = unitedMin + range * (1 - (this.to as any));
                    }

                    if (this.shouldUpdateExtremes(e.DOMType)) {
                        axis.setExtremes(
                            from,
                            to,
                            true,
                            e.DOMType !== 'mousemove' && e.DOMType !== 'touchmove',
                            e
                        );
                    } else {
                        // When live redraw is disabled, don't change extremes
                        // Only change the position of the scollbar thumb
                        this.setRange(this.from as any, this.to as any);
                    }
                });
            }
        });

        // Wrap rendering axis, and update scrollbar if one is created:
        addEvent(AxisClass, 'afterRender', function (): void {
            let axis = this as ScrollbarAxis,
                {
                    scrollMin,
                    scrollMax
                } = getExtremes(axis),
                scrollbar = axis.scrollbar,
                offset = (axis.axisTitleMargin as any) + (axis.titleOffset || 0),
                scrollbarsOffsets = axis.chart.scrollbarsOffsets,
                axisMargin = axis.options.margin || 0,
                offsetsIndex,
                from,
                to;

            if (scrollbar) {

                if (axis.horiz) {

                    // Reserve space for labels/title
                    if (!axis.opposite) {
                        (scrollbarsOffsets as any)[1] += offset;
                    }

                    scrollbar.position(
                        axis.left,
                        axis.top + axis.height + 2 + (scrollbarsOffsets as any)[1] -
                            (axis.opposite ? axisMargin : 0),
                        axis.width,
                        axis.height
                    );

                    // Next scrollbar should reserve space for margin (if set)
                    if (!axis.opposite) {
                        (scrollbarsOffsets as any)[1] += axisMargin;
                    }

                    offsetsIndex = 1;
                } else {

                    // Reserve space for labels/title
                    if (axis.opposite) {
                        (scrollbarsOffsets as any)[0] += offset;
                    }

                    let xPosition;
                    if (!scrollbar.options.opposite) {
                        xPosition = axis.opposite ? 0 : axisMargin;
                    } else {
                        xPosition = axis.left + axis.width + 2 + (scrollbarsOffsets as any)[0] -
                            (axis.opposite ? 0 : axisMargin);
                    }

                    scrollbar.position(
                        xPosition,
                        axis.top,
                        axis.width,
                        axis.height
                    );

                    // Next scrollbar should reserve space for margin (if set)
                    if (axis.opposite) {
                        (scrollbarsOffsets as any)[0] += axisMargin;
                    }

                    offsetsIndex = 0;
                }

                (scrollbarsOffsets as any)[offsetsIndex] += scrollbar.size +
                    (scrollbar.options.margin as any);

                if (
                    isNaN(scrollMin) ||
                    isNaN(scrollMax) ||
                    !defined(axis.min) ||
                    !defined(axis.max) ||
                    axis.min === axis.max // #10733
                ) {
                    // default action: when extremes are the same or there is
                    // not extremes on the axis, but scrollbar exists, make it
                    // full size
                    scrollbar.setRange(0, 1);
                } else {
                    from =
                        ((axis.min as any) - scrollMin) / (scrollMax - scrollMin);
                    to =
                        ((axis.max as any) - scrollMin) / (scrollMax - scrollMin);

                    if (
                        (axis.horiz && !axis.reversed) ||
                        (!axis.horiz && axis.reversed)
                    ) {
                        scrollbar.setRange(from, to);
                    } else {
                        // inverse vertical axis
                        scrollbar.setRange(1 - to, 1 - from);
                    }
                }
            }
        });

        // Make space for a scrollbar:
        addEvent(AxisClass, 'afterGetOffset', function (): void {
            const axis = this as ScrollbarAxis,
                opposite = axis.scrollbar && !axis.scrollbar.options.opposite,
                index = axis.horiz ? 2 : opposite ? 3 : 1,
                scrollbar = axis.scrollbar;

            if (scrollbar) {
                axis.chart.scrollbarsOffsets = [0, 0]; // reset scrollbars offsets
                axis.chart.axisOffset[index] +=
                    scrollbar.size + (scrollbar.options.margin as any);
            }
        });

        return AxisClass as (T&ScrollbarAxis);
    }
}

interface ScrollbarAxis extends Axis {
    options: Axis['options'] & ScrollbarAxis.Options;
    scrollbar: Scrollbar;
}

namespace ScrollbarAxis {

    export interface Options {
        scrollbar?: ScrollbarOptions;
    }

}

export default ScrollbarAxis;
