import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ResultsChartProps {
    data: { name: string; votes: number }[];
    theme: 'light' | 'dark';
}

const ResultsChart: React.FC<ResultsChartProps> = ({ data, theme }) => {
    const tickColor = theme === 'dark' ? '#9ca3af' : '#6b7281'; // gray-400 vs gray-500
    const gridColor = theme === 'dark' ? '#374151' : '#e5e7eb'; // gray-700 vs gray-200

    return (
        <div className="w-full h-96 bg-white dark:bg-gray-800 p-4 rounded-lg shadow transition-colors">
            <ResponsiveContainer>
                <BarChart
                    data={data}
                    margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                    }}
                >
                    <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis dataKey="name" stroke={tickColor} tick={{ fill: tickColor }} />
                    <YAxis allowDecimals={false} stroke={tickColor} tick={{ fill: tickColor }} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                            borderColor: gridColor
                        }}
                        itemStyle={{ color: tickColor }}
                        cursor={{fill: theme === 'dark' ? 'rgba(156, 163, 175, 0.1)' : 'rgba(209, 213, 219, 0.4)'}}
                    />
                    <Legend wrapperStyle={{ color: tickColor }} />
                    <Bar dataKey="votes" fill="#3b82f6" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default ResultsChart;
