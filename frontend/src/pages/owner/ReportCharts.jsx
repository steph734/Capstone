import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  LineController,
  BarController,
  Tooltip,
  Filler,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, LineController, BarController, Tooltip, Filler)

const AXIS_TICK = { color: '#9aab9f', font: { size: 11 } }

/* ---------- Tiny inline trend sparkline (used on report cards) ---------- */
export function Sparkline({ trend, color = '#2a9d8f', height = 44 }) {
  const data = {
    labels: trend.map((_, i) => i),
    datasets: [
      {
        data: trend,
        borderColor: color,
        backgroundColor: `${color}26`,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: { x: { display: false }, y: { display: false } },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  }
  return (
    <div style={{ width: '100%', height }}>
      <Line data={data} options={options} />
    </div>
  )
}

/* ---------- Larger trend line chart (drill-down modal) ---------- */
export function TrendChart({ months, trend, color = '#2a9d8f', valueFormatter = (v) => v, height = 220 }) {
  const data = {
    labels: months,
    datasets: [
      {
        data: trend,
        borderColor: color,
        backgroundColor: `${color}22`,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: color,
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
        borderWidth: 2,
      },
    ],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => valueFormatter(ctx.parsed.y) } },
    },
    scales: {
      x: { grid: { display: false }, ticks: AXIS_TICK },
      y: { grid: { color: '#eef4f1' }, ticks: { ...AXIS_TICK, callback: (v) => valueFormatter(v) } },
    },
  }
  return (
    <div style={{ height }}>
      <Line data={data} options={options} />
    </div>
  )
}

/* ---------- Breakdown bar chart (per-entity snapshot, drill-down modal) ---------- */
export function BreakdownChart({ labels, values, color = '#3b82f6', valueFormatter = (v) => v, height = 200 }) {
  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: color,
        borderRadius: 6,
        maxBarThickness: 40,
      },
    ],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => valueFormatter(ctx.parsed.y) } },
    },
    scales: {
      x: { grid: { display: false }, ticks: AXIS_TICK },
      y: { grid: { color: '#eef4f1' }, ticks: { ...AXIS_TICK, callback: (v) => valueFormatter(v) } },
    },
  }
  return (
    <div style={{ height }}>
      <Bar data={data} options={options} />
    </div>
  )
}
