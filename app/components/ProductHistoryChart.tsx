'use client';

import React, { useState, useMemo } from 'react';

interface PricePoint {
    price: number;
    date: string;
}

interface ProductHistoryChartProps {
    history: PricePoint[];
}

export default function ProductHistoryChart({ history = [] }: ProductHistoryChartProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    // Sort history by date
    const sortedHistory = useMemo(() => {
        return [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [history]);

    if (sortedHistory.length === 0) {
        return (
            <div className="w-full h-48 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 text-sm">
                No price history available
            </div>
        );
    }

    const prices = sortedHistory.map(p => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || 1; // Avoid division by zero

    // Add some padding to Y-axis (10% top and bottom)
    const yMin = minPrice - (range * 0.1);
    const yMax = maxPrice + (range * 0.1);
    const yRange = yMax - yMin || 1;

    // Chart dimensions
    const width = 100;
    const height = 50;

    // Generate path data
    const points = sortedHistory.map((d, i) => {
        const x = sortedHistory.length > 1
            ? (i / (sortedHistory.length - 1)) * width
            : width / 2; // Center if single point
        const y = height - ((d.price - yMin) / yRange) * height;
        return `${x},${y}`;
    }).join(' ');

    const areaPath = sortedHistory.length > 1
        ? `M 0,${height} ${points} L ${width},${height} Z`
        : `M 0,${height} L ${width / 2},${height - ((prices[0] - yMin) / yRange) * height} L ${width},${height} Z`; // Triangle for single point? Or just flat?

    // Better area for single point: flat line at bottom? No, let's just show the point.
    // Actually, for single point, area fill might look weird. Let's handle single point specifically in rendering.

    const linePath = sortedHistory.length > 1
        ? `M ${points.split(' ')[0]} L ${points.split(' ').slice(1).join(' ')}`
        : '';

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex-1 relative w-full min-h-[200px]" onMouseLeave={() => setHoveredIndex(null)}>
                {/* Chart Clipper */}
                <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gray-50">
                    {/* SVG Chart */}
                    <svg
                        className="w-full h-full overflow-visible"
                        viewBox={`0 0 ${width} ${height}`}
                        preserveAspectRatio="none"
                    >
                        <defs>
                            <linearGradient id="historyGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#064e3b" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="#064e3b" stopOpacity="0.0" />
                            </linearGradient>
                        </defs>

                        {/* Grid Lines */}
                        <g className="opacity-10">
                            {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
                                <line
                                    key={tick}
                                    x1="0"
                                    y1={height * tick}
                                    x2={width}
                                    y2={height * tick}
                                    stroke="currentColor"
                                    strokeWidth="0.2"
                                    strokeDasharray="1,1"
                                />
                            ))}
                        </g>

                        {/* Area Fill (only if > 1 point) */}
                        {sortedHistory.length > 1 && (
                            <path d={areaPath} fill="url(#historyGradient)" />
                        )}

                        {/* Line Stroke */}
                        {sortedHistory.length > 1 && (
                            <path
                                d={linePath}
                                fill="none"
                                stroke="#064e3b"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                            />
                        )}

                        {/* Points & Hover Effects */}
                        {sortedHistory.map((d, i) => {
                            const x = sortedHistory.length > 1
                                ? (i / (sortedHistory.length - 1)) * width
                                : width / 2;
                            const y = height - ((d.price - yMin) / yRange) * height;

                            return (
                                <g key={i} onMouseEnter={() => setHoveredIndex(i)}>
                                    {/* Invisible hit area */}
                                    <rect
                                        x={sortedHistory.length > 1 ? x - (width / sortedHistory.length / 2) : 0}
                                        y="0"
                                        width={sortedHistory.length > 1 ? width / sortedHistory.length : width}
                                        height={height}
                                        fill="transparent"
                                        className="cursor-crosshair"
                                    />

                                    {/* Point */}
                                    {(hoveredIndex === i || sortedHistory.length === 1) && (
                                        <>
                                            <line
                                                x1={x} y1="0" x2={x} y2={height}
                                                stroke="#064e3b"
                                                strokeWidth="0.5"
                                                strokeDasharray="2,2"
                                                opacity="0.5"
                                                vectorEffect="non-scaling-stroke"
                                            />
                                            <circle
                                                cx={x} cy={y} r="2"
                                                fill="white"
                                                stroke="#064e3b"
                                                strokeWidth="1.5"
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        </>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                </div>

                {/* Tooltip */}
                {hoveredIndex !== null && (
                    <div
                        className="absolute z-20 bg-gray-900 text-white text-xs rounded-lg py-1.5 px-3 shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full"
                        style={{
                            left: sortedHistory.length > 1
                                ? `${(hoveredIndex / (sortedHistory.length - 1)) * 100}%`
                                : '50%',
                            top: `${100 - ((sortedHistory[hoveredIndex].price - yMin) / yRange) * 100}%`,
                            marginTop: '-10px'
                        }}
                    >
                        <div className="font-bold whitespace-nowrap">KES {sortedHistory[hoveredIndex].price.toLocaleString()}</div>
                        <div className="text-gray-400 text-[10px]">{sortedHistory[hoveredIndex].date}</div>
                    </div>
                )}
            </div>

            {/* X-Axis Labels */}
            <div className="flex justify-between text-[10px] text-gray-400 font-medium px-1 pt-2">
                {sortedHistory.length > 1 ? (
                    <>
                        <span>{sortedHistory[0].date.split(',')[0]}</span>
                        <span>{sortedHistory[sortedHistory.length - 1].date.split(',')[0]}</span>
                    </>
                ) : (
                    <span className="w-full text-center">{sortedHistory[0].date.split(',')[0]}</span>
                )}
            </div>
        </div>
    );
}
