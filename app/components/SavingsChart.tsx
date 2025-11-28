'use client';

import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

import { TrackedItem } from '@/lib/types';

interface SavingsChartProps {
    trackedItems: TrackedItem[];
    targetSavings?: number | null;
    onSetTarget?: () => void;
}

export default function SavingsChart({ trackedItems = [], targetSavings, onSetTarget }: SavingsChartProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    // Process data to get daily potential savings for the last 14 days
    const chartData = useMemo(() => {
        const days = 14;
        const data = [];
        const now = new Date();

        // Generate dates for the last 14 days
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0); // Normalize to start of day

            let totalSavings = 0;
            let activeItems = 0;

            trackedItems.forEach(item => {
                // Find the price record for this day or the most recent one before it
                const itemHistory = [...item.priceHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                const record = itemHistory.find(h => {
                    const hDate = new Date(h.date);
                    hDate.setHours(0, 0, 0, 0);
                    return hDate.getTime() <= date.getTime();
                });

                if (record) {
                    const basePrice = item.originalPrice || item.retailPrice || 0;
                    if (basePrice > record.price) {
                        totalSavings += (basePrice - record.price);
                        activeItems++;
                    }
                }
            });

            data.push({
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                fullDate: date.toLocaleDateString(),
                savings: totalSavings,
                count: activeItems
            });
        }
        return data;
    }, [trackedItems]);

    const maxSavings = Math.max(
        ...chartData.map(d => d.savings),
        targetSavings || 0,
        100
    );
    const currentSavings = chartData[chartData.length - 1].savings;
    const previousSavings = chartData[chartData.length - 2]?.savings || 0;
    const isUp = currentSavings >= previousSavings;

    // Chart dimensions
    const width = 100;
    const height = 50;
    const padding = 0;

    // Generate path data
    const points = chartData.map((d, i) => {
        const x = (i / (chartData.length - 1)) * width;
        const y = height - (d.savings / maxSavings) * height;
        return `${x},${y}`;
    }).join(' ');

    const areaPath = `M 0,${height} ${points} L ${width},${height} Z`;
    const linePath = `M ${points.split(' ')[0]} L ${points.split(' ').slice(1).join(' ')}`;

    // Target Line Y position
    const targetY = targetSavings ? height - (targetSavings / maxSavings) * height : null;

    // Format large numbers (e.g. 150000 -> 150k)
    const formatValue = (value: number) => {
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
        return value.toLocaleString();
    };

    return (
        <div className="w-full h-full flex flex-col">
            {/* Header with Stats */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        {onSetTarget && (
                            <button
                                onClick={onSetTarget}
                                className="text-[10px] font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full hover:bg-green-100 transition-colors"
                            >
                                {targetSavings ? `Target: ${targetSavings.toLocaleString()}` : 'Set Target'}
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Potential savings from price drops (Last 14 Days)</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                        KES {currentSavings.toLocaleString()}
                    </div>
                    <div className={`flex items-center justify-end gap-1 text-xs font-medium ${isUp ? 'text-green-600' : 'text-red-500'}`}>
                        {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        <span>{Math.abs(currentSavings - previousSavings).toLocaleString()} today</span>
                    </div>
                </div>
            </div>

            {/* Chart Container */}
            <div className="flex-1 flex flex-col min-h-0" onMouseLeave={() => setHoveredIndex(null)}>
                <div className="flex-1 relative w-full">
                    {/* Y-Axis Labels (Right side) */}
                    <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-between text-[10px] text-gray-400 font-medium pointer-events-none z-10 text-right pr-1 w-10">
                        <span>{formatValue(Math.round(maxSavings))}</span>
                        <span>{formatValue(Math.round(maxSavings * 0.75))}</span>
                        <span>{formatValue(Math.round(maxSavings * 0.5))}</span>
                        <span>{formatValue(Math.round(maxSavings * 0.25))}</span>
                        <span>0</span>
                    </div>

                    {/* Chart Clipper */}
                    <div className="absolute inset-0 overflow-hidden pr-10">
                        {/* SVG Chart */}
                        <svg
                            className="w-full h-full overflow-visible"
                            viewBox={`0 0 ${width} ${height}`}
                            preserveAspectRatio="none"
                        >
                            <defs>
                                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#064e3b" stopOpacity="0.2" />
                                    <stop offset="100%" stopColor="#064e3b" stopOpacity="0.0" />
                                </linearGradient>
                                <mask id="gridMask">
                                    <rect x="0" y="0" width={width} height={height} fill="white" />
                                </mask>
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

                            {/* Target Line */}
                            {targetY !== null && (
                                <g>
                                    <line
                                        x1="0" y1={targetY} x2={width} y2={targetY}
                                        stroke="#f59e0b"
                                        strokeWidth="0.3"
                                        strokeDasharray="3,3"
                                        opacity="0.6"
                                    />
                                    <text
                                        x="0" y={targetY - 1.5}
                                        fill="#f59e0b"
                                        fontSize="2"
                                        opacity="0.8"
                                    >
                                        Target: {formatValue(targetSavings || 0)}
                                    </text>
                                </g>
                            )}

                            {/* Area Fill */}
                            <path d={areaPath} fill="url(#chartGradient)" />

                            {/* Line Stroke */}
                            <path
                                d={linePath}
                                fill="none"
                                stroke="#064e3b"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                            />

                            {/* Hover Effects */}
                            {chartData.map((d, i) => {
                                const x = (i / (chartData.length - 1)) * width;
                                const y = height - (d.savings / maxSavings) * height;

                                return (
                                    <g key={i} onMouseEnter={() => setHoveredIndex(i)}>
                                        {/* Invisible hit area */}
                                        <rect
                                            x={x - (width / chartData.length / 2)}
                                            y="0"
                                            width={width / chartData.length}
                                            height={height}
                                            fill="transparent"
                                            className="cursor-crosshair"
                                        />

                                        {/* Active Point Indicator */}
                                        {hoveredIndex === i && (
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
                                                    cx={x} cy={y} r="1.5"
                                                    fill="white"
                                                    stroke="#064e3b"
                                                    strokeWidth="1"
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
                                left: `${(hoveredIndex / (chartData.length - 1)) * 100}%`,
                                top: `${100 - (chartData[hoveredIndex].savings / maxSavings) * 100}%`,
                                marginTop: '-10px'
                            }}
                        >
                            <div className="font-bold whitespace-nowrap">KES {chartData[hoveredIndex].savings.toLocaleString()}</div>
                            <div className="text-gray-400 text-[10px]">{chartData[hoveredIndex].fullDate}</div>
                        </div>
                    )}
                </div>

                {/* X-Axis Labels (Outside SVG) */}
                <div className="flex justify-between text-[10px] text-gray-400 font-medium px-1 pt-2 pr-10">
                    {chartData.filter((_, i) => i % 2 === 0).map((d, i) => (
                        <span key={i}>{d.date}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}
