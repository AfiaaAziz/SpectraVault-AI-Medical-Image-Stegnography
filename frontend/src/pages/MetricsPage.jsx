import { useEffect, useMemo, useState } from 'react'
import DemoBanner from '../components/DemoBanner.jsx'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
} from 'recharts'
import styles from './MetricsPage.module.css'

const SPLIT_TEMPLATE = [
  { split: 'Train', LSB_psnr: 71.95, DCT_psnr: 46.8, FFT_psnr: 41.3 },
  { split: 'Val', LSB_psnr: 72.02, DCT_psnr: 46.5, FFT_psnr: 40.8 },
  { split: 'Test', LSB_psnr: 71.85, DCT_psnr: 46.7, FFT_psnr: 41.0 },
]

const SSIM_DATA = [
  { split: 'Train', LSB_ssim: 0.999993, DCT_ssim: 0.99981, FFT_ssim: 0.99863 },
  { split: 'Val', LSB_ssim: 0.999992, DCT_ssim: 0.99978, FFT_ssim: 0.99851 },
  { split: 'Test', LSB_ssim: 0.999993, DCT_ssim: 0.9998, FFT_ssim: 0.99858 },
]

const ACCURACY_DATA = [
  { split: 'Train', LSB: 100, DCT: 100, FFT: 95 },
  { split: 'Val', LSB: 100, DCT: 100, FFT: 94 },
  { split: 'Test', LSB: 100, DCT: 100, FFT: 93 },
]

const ROBUSTNESS_DATA = [
  { attack: 'Gaussian σ=5', LSB: 100, DCT: 100, FFT: 85 },
  { attack: 'Salt & Pepper', LSB: 100, DCT: 98, FFT: 80 },
  { attack: 'JPEG Q=75', LSB: 62, DCT: 88, FFT: 100 },
  { attack: 'JPEG Q=50', LSB: 24, DCT: 75, FFT: 100 },
  { attack: 'Resize 0.5×', LSB: 0, DCT: 42, FFT: 78 },
  { attack: 'Gaussian Blur', LSB: 100, DCT: 95, FFT: 90 },
  { attack: 'Median 3×3', LSB: 98, DCT: 90, FFT: 85 },
]

const RADAR_DATA = [
  { metric: 'PSNR', LSB: 100, DCT: 82, FFT: 63 },
  { metric: 'SSIM', LSB: 100, DCT: 95, FFT: 78 },
  { metric: 'Capacity', LSB: 100, DCT: 60, FFT: 60 },
  { metric: 'Robustness', LSB: 55, DCT: 78, FFT: 100 },
  { metric: 'Speed', LSB: 100, DCT: 70, FFT: 60 },
]

const MSE_DATA = [
  { name: 'LSB', value: 0.0042, psnr: 71.9 },
  { name: 'DCT', value: 0.031, psnr: 46.8 },
  { name: 'FFT', value: 0.089, psnr: 41.3 },
]

const DEFAULT_SUMMARY = [
  { method: 'LSB', color: '#00e5a0', psnr: '71.9 dB', ssim: '0.999993', accuracy: '100%', capacity: 'High', robustness: 'Low' },
  { method: 'DCT', color: '#00b8d9', psnr: '—', ssim: '—', accuracy: '—', capacity: 'Med', robustness: 'Med' },
  { method: 'FFT', color: '#a855f7', psnr: '—', ssim: '—', accuracy: '—', capacity: 'Med', robustness: 'High' },
]

const AI_STATS = [
  { label: 'Model', val: 'DenseNet-121' },
  { label: 'Training dataset', val: 'NIH ChestX-ray14' },
  { label: 'Total images', val: '112,120' },
  { label: 'Pathologies', val: '14' },
  { label: 'AI threshold', val: '0.30 (30%)' },
  { label: 'Eval images', val: '20 per split' },
]

function CustomTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{label}</p>
      {payload.map(p => (
        <div key={String(p.name)} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: p.fill || p.stroke }} />
          <span>
            {p.name}: <strong>{p.value}{unit}</strong>
          </span>
        </div>
      ))}
    </div>
  )
}

function ChartCard({ title, tag, children, fullWidth }) {
  return (
    <div className={`${styles.chartCard} ${fullWidth ? styles.chartCardFull : ''}`}>
      <div className={styles.chartCardHeader}>
        <h3 className={styles.chartTitle}>{title}</h3>
        {tag && <span className={styles.chartTag}>{tag}</span>}
      </div>
      <div className={styles.chartBody}>{children}</div>
    </div>
  )
}

export default function MetricsPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [live, setLive] = useState(null)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    fetch('/data/metrics.json')
      .then(r => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then(setLive)
      .catch(() => setLoadError('Using built-in reference metrics until live evaluation data is available.'))
  }, [])

  const splitData = useMemo(() => {
    if (!live?.splits) return SPLIT_TEMPLATE
    const keyMap = { Train: 'train', Val: 'val', Test: 'test' }
    return SPLIT_TEMPLATE.map(row => ({
      ...row,
      LSB_psnr: live.splits[keyMap[row.split]]?.lsb_psnr ?? row.LSB_psnr,
    }))
  }, [live])

  const summaryCards = useMemo(() => {
    if (!live?.lsb) return DEFAULT_SUMMARY
    const l = live.lsb
    const psnr = typeof l.avg_psnr === 'number' && !Number.isNaN(l.avg_psnr) ? `${l.avg_psnr.toFixed(2)} dB` : DEFAULT_SUMMARY[0].psnr
    const ssim = typeof l.avg_ssim === 'number' && !Number.isNaN(l.avg_ssim) ? l.avg_ssim.toFixed(6) : DEFAULT_SUMMARY[0].ssim
    const acc = typeof l.extraction_accuracy === 'number' ? `${(l.extraction_accuracy * 100).toFixed(1)}%` : DEFAULT_SUMMARY[0].accuracy
    const next = [...DEFAULT_SUMMARY]
    next[0] = { ...next[0], psnr, ssim, accuracy: acc }
    return next
  }, [live])

  const mseList = useMemo(() => {
    if (!live?.lsb?.avg_mse) return MSE_DATA
    const copy = MSE_DATA.map(x => ({ ...x }))
    copy[0] = { ...copy[0], value: live.lsb.avg_mse, psnr: live.lsb.avg_psnr?.toFixed(2) ?? copy[0].psnr }
    return copy
  }, [live])

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'psnr', label: 'PSNR / SSIM' },
    { id: 'robustness', label: 'Robustness' },
    { id: 'ai', label: 'AI model' },
  ]

  return (
    <div className={`${styles.page} page-enter`}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.headerTag}>Evaluation</span>
          <h1 className={styles.title}>Performance metrics</h1>
          <p className={styles.sub}>
            PSNR, SSIM, recovery rates, and robustness under noise, compression, and resize—LSB, DCT, and FFT side by side for a quick quality-versus-robustness read.
          </p>
        </div>

        <DemoBanner variant="metrics" />

        {(live?.note || loadError) && (
          <div className={styles.banner}>
            {live?.note && <p>{live.note}</p>}
            {loadError && <p className={styles.bannerMuted}>{loadError}</p>}
          </div>
        )}

        <div className={styles.summaryGrid}>
          {summaryCards.map(m => (
            <div key={m.method} className={styles.summaryCard} style={{ borderTopColor: m.color }}>
              <div className={styles.summaryMethod} style={{ color: m.color }}>
                {m.method}
              </div>
              <div className={styles.summaryRows}>
                {[
                  ['PSNR', m.psnr],
                  ['SSIM', m.ssim],
                  ['Accuracy', m.accuracy],
                  ['Capacity', m.capacity],
                  ['Robustness', m.robustness],
                ].map(([k, v]) => (
                  <div key={k} className={styles.summaryRow}>
                    <span className={styles.summaryKey}>{k}</span>
                    <span className={styles.summaryVal}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.tabs}>
          {TABS.map(t => (
            <button type="button" key={t.id} className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`} onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className={styles.chartsGrid}>
            <ChartCard title="PSNR by method and split" tag="dB — higher is better">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={splitData} barGap={2} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="split" tick={{ fill: '#7a9aaa', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[35, 80]} tick={{ fill: '#7a9aaa', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip unit=" dB" />} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#7a9aaa' }} />
                  <Bar dataKey="LSB_psnr" name="LSB" fill="#00e5a0" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="DCT_psnr" name="DCT" fill="#00b8d9" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="FFT_psnr" name="FFT" fill="#a855f7" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Extraction accuracy" tag="Illustrative · DCT/FFT pending">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={ACCURACY_DATA} barGap={2} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="split" tick={{ fill: '#7a9aaa', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[80, 105]} tick={{ fill: '#7a9aaa', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip unit="%" />} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#7a9aaa' }} />
                  <Bar dataKey="LSB" fill="#00e5a0" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="DCT" fill="#00b8d9" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="FFT" fill="#a855f7" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Method comparison radar" tag="Normalized scores">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={RADAR_DATA} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: '#7a9aaa', fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="LSB" dataKey="LSB" stroke="#00e5a0" fill="#00e5a0" fillOpacity={0.12} />
                  <Radar name="DCT" dataKey="DCT" stroke="#00b8d9" fill="#00b8d9" fillOpacity={0.12} />
                  <Radar name="FFT" dataKey="FFT" stroke="#a855f7" fill="#a855f7" fillOpacity={0.12} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#7a9aaa' }} />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="MSE per method" tag="lower is better">
              <div className={styles.mseList}>
                {mseList.map((m, i) => (
                  <div key={m.name} className={styles.mseItem}>
                    <span className={styles.mseName} style={{ color: ['#00e5a0', '#00b8d9', '#a855f7'][i] }}>
                      {m.name}
                    </span>
                    <div className={styles.mseBar}>
                      <div
                        className={styles.mseBarFill}
                        style={{
                          width: `${Math.min(100, (m.value / 0.1) * 100)}%`,
                          background: ['#00e5a0', '#00b8d9', '#a855f7'][i],
                        }}
                      />
                    </div>
                    <span className={`${styles.mseVal} ${styles.mono}`}>{m.value}</span>
                    <span className={`${styles.msePsnr} ${styles.mono}`}>{m.psnr} dB</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        )}

        {activeTab === 'psnr' && (
          <div className={styles.chartsGrid}>
            <ChartCard title="PSNR across splits" tag="All three methods">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={splitData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="split" tick={{ fill: '#7a9aaa', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[38, 80]} tick={{ fill: '#7a9aaa', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip unit=" dB" />} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#7a9aaa' }} />
                  <Line type="monotone" dataKey="LSB_psnr" name="LSB" stroke="#00e5a0" strokeWidth={2.5} dot={{ fill: '#00e5a0', r: 5 }} />
                  <Line type="monotone" dataKey="DCT_psnr" name="DCT" stroke="#00b8d9" strokeWidth={2.5} dot={{ fill: '#00b8d9', r: 5 }} />
                  <Line type="monotone" dataKey="FFT_psnr" name="FFT" stroke="#a855f7" strokeWidth={2.5} dot={{ fill: '#a855f7', r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="SSIM across splits" tag="Higher is better">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={SSIM_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="split" tick={{ fill: '#7a9aaa', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0.998, 1.001]} tick={{ fill: '#7a9aaa', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#7a9aaa' }} />
                  <Line type="monotone" dataKey="LSB_ssim" name="LSB" stroke="#00e5a0" strokeWidth={2.5} dot={{ fill: '#00e5a0', r: 5 }} />
                  <Line type="monotone" dataKey="DCT_ssim" name="DCT" stroke="#00b8d9" strokeWidth={2.5} dot={{ fill: '#00b8d9', r: 5 }} />
                  <Line type="monotone" dataKey="FFT_ssim" name="FFT" stroke="#a855f7" strokeWidth={2.5} dot={{ fill: '#a855f7', r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Detailed quality summary" fullWidth>
              <div className={styles.qualityTable}>
                <div className={styles.qtHeader}>
                  <span>Method</span>
                  <span>PSNR (dB)</span>
                  <span>MSE</span>
                  <span>SSIM</span>
                  <span>Accuracy</span>
                  <span>Quality</span>
                </div>
                {[
                  { m: 'LSB', psnr: summaryCards[0].psnr, mse: mseList[0].value, ssim: summaryCards[0].ssim, acc: summaryCards[0].accuracy, q: 'Excellent', color: '#00e5a0' },
                  { m: 'DCT', psnr: '—', mse: '—', ssim: '—', acc: summaryCards[1].accuracy, q: 'Pending', color: '#00b8d9' },
                  { m: 'FFT', psnr: '—', mse: '—', ssim: '—', acc: summaryCards[2].accuracy, q: 'Pending', color: '#a855f7' },
                ].map(r => (
                  <div key={r.m} className={styles.qtRow}>
                    <span className={styles.qtMethod} style={{ color: r.color }}>
                      {r.m}
                    </span>
                    <span className={styles.mono}>{r.psnr}</span>
                    <span className={styles.mono}>{typeof r.mse === 'number' ? r.mse.toFixed(4) : r.mse}</span>
                    <span className={styles.mono}>{r.ssim}</span>
                    <span className={styles.mono} style={{ color: '#00e5a0' }}>
                      {r.acc}
                    </span>
                    <span className={styles.qualityPill}>{r.q}</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        )}

        {activeTab === 'robustness' && (
          <div className={styles.chartsGrid}>
            <ChartCard title="Robustness under attacks" tag="Illustrative · notebook reference" fullWidth>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={ROBUSTNESS_DATA} barGap={4} barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="attack" tick={{ fill: '#7a9aaa', fontSize: 11 }} axisLine={false} tickLine={false} angle={-15} textAnchor="end" height={60} />
                  <YAxis domain={[0, 110]} tick={{ fill: '#7a9aaa', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip unit="%" />} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#7a9aaa' }} />
                  <Bar dataKey="LSB" fill="#00e5a0" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="DCT" fill="#00b8d9" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="FFT" fill="#a855f7" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Robustness table" fullWidth>
              <div className={styles.robTable}>
                <div className={styles.robHeader}>
                  <span>Attack</span>
                  <span>LSB</span>
                  <span>DCT</span>
                  <span>FFT</span>
                </div>
                {ROBUSTNESS_DATA.map(r => (
                  <div key={r.attack} className={styles.robRow}>
                    <span className={styles.robAttack}>{r.attack}</span>
                    {[r.LSB, r.DCT, r.FFT].map((v, i) => (
                      <span
                        key={i}
                        className={`${styles.robVal} ${styles.mono}`}
                        style={{
                          color: v >= 90 ? '#00e5a0' : v >= 70 ? '#00b8d9' : v >= 40 ? '#ff6b35' : '#ef4444',
                        }}
                      >
                        {v}%
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className={styles.chartsGrid}>
            <ChartCard title="DenseNet-121 configuration">
              <div className={styles.aiStats}>
                {AI_STATS.map(s => (
                  <div key={s.label} className={styles.aiStat}>
                    <span className={styles.aiStatKey}>{s.label}</span>
                    <span className={`${styles.aiStatVal} ${styles.mono}`}>{s.val}</span>
                  </div>
                ))}
              </div>
            </ChartCard>

            <ChartCard title="Disease detection pathologies" tag="14 classes">
              <div className={styles.diseaseGrid}>
                {[
                  ['Atelectasis', '#00e5a0'],
                  ['Cardiomegaly', '#00b8d9'],
                  ['Consolidation', '#a855f7'],
                  ['Edema', '#ff6b35'],
                  ['Effusion', '#00e5a0'],
                  ['Emphysema', '#00b8d9'],
                  ['Fibrosis', '#a855f7'],
                  ['Hernia', '#ff6b35'],
                  ['Infiltration', '#00e5a0'],
                  ['Mass', '#00b8d9'],
                  ['Nodule', '#a855f7'],
                  ['Pleural_Thickening', '#ff6b35'],
                  ['Pneumonia', '#00e5a0'],
                  ['Pneumothorax', '#00b8d9'],
                ].map(([d, c]) => (
                  <div key={d} className={styles.diseaseBadge} style={{ borderColor: `${c}33`, color: c }}>
                    {d}
                  </div>
                ))}
              </div>
            </ChartCard>

            <ChartCard title="Sample AI confidence scores" tag="DenseNet-121 probabilities" fullWidth>
              <div className={styles.confBars}>
                {[
                  ['Atelectasis', 0.72],
                  ['Effusion', 0.45],
                  ['Infiltration', 0.38],
                  ['Nodule', 0.31],
                  ['Cardiomegaly', 0.18],
                  ['Consolidation', 0.12],
                ].map(([d, v]) => (
                  <div key={d} className={styles.confRow}>
                    <span className={styles.confLabel}>{d}</span>
                    <div className={styles.confBar}>
                      <div className={styles.confFill} style={{ width: `${v * 100}%`, opacity: v >= 0.3 ? 1 : 0.4 }} />
                      <div className={styles.threshold} title="Threshold 0.30" />
                    </div>
                    <span className={`${styles.confVal} ${styles.mono}`} style={{ color: v >= 0.3 ? '#00e5a0' : '#7a9aaa' }}>
                      {(v * 100).toFixed(1)}%
                      {v >= 0.3 && <span className={styles.detectedTag}>DETECTED</span>}
                    </span>
                  </div>
                ))}
              </div>
              <p className={styles.thresholdNote}>Threshold at 30% — pathologies above this are candidates for metadata.</p>
            </ChartCard>
          </div>
        )}
      </div>
    </div>
  )
}
