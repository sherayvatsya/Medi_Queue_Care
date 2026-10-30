import React, { useState, useMemo } from 'react';
import { Doctor, Patient } from '../types';
import { playHospitalChime, playUrgentAlertSound } from '../utils/audio';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  Info,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';

interface HospitalOvercrowdingPredictorProps {
  doctors: Doctor[];
  patients: Patient[];
  onShowToast?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void;
}

export type OvercrowdRiskLevel = 'Low' | 'Medium' | 'High';

export interface DepartmentMetrics {
  department: string;
  activeDoctors: number;
  totalDoctors: number;
  waitingCount: number;
  inConsultCount: number;
  avgConsultMinutes: number;
  hourlyCapacity: number;
  predictedArrivalsNextHour: number;
  currentWaitMinutes: number;
  projectedWaitMinutesNextHour: number;
  currentRisk: OvercrowdRiskLevel;
  projectedRisk: OvercrowdRiskLevel;
}

export interface SimulationResult {
  scenarioName: 'surge' | 'extra_doctor' | 'none';
  label: string;
  simulatedDoctors: number;
  simulatedWaiting: number;
  simulatedWaitMinutes: number;
  simulatedRisk: OvercrowdRiskLevel;
  waitDeltaMinutes: number;
  queueDelta: number;
  recommendations: string[];
}

export const HospitalOvercrowdingPredictor: React.FC<HospitalOvercrowdingPredictorProps> = ({
  doctors,
  patients,
  onShowToast,
}) => {
  // Department filter
  const [selectedDept, setSelectedDept] = useState<string>('All Departments');
  // Active simulation mode
  const [activeSimulation, setActiveSimulation] = useState<'none' | 'surge' | 'extra_doctor'>('none');
  // Surge magnitude parameter
  const [surgePatientCount, setSurgePatientCount] = useState<number>(12);
  // Human approval modal state for operational recommendation
  const [approvedActionNotice, setApprovedActionNotice] = useState<string | null>(null);

  // Extract all distinct departments
  const departmentList = useMemo(() => {
    const set = new Set<string>();
    doctors.forEach((d) => set.add(d.department));
    patients.forEach((p) => {
      if (p.department && p.department !== 'Emergency & Trauma') set.add(p.department);
    });
    if (set.size === 0) {
      return ['Cardiology', 'General Medicine', 'Orthopedics', 'Pulmonology'];
    }
    return Array.from(set).sort();
  }, [doctors, patients]);

  // Compute baseline metrics per department
  const departmentMetrics = useMemo((): DepartmentMetrics[] => {
    const list = selectedDept === 'All Departments' ? departmentList : [selectedDept];

    return list.map((dept) => {
      const deptDoctors = doctors.filter((d) => d.department === dept);
      const activeDocs = deptDoctors.filter((d) => d.status === 'in_room').length;
      const effectiveActiveDocs = Math.max(activeDocs, 1); // at least 1 physician capacity baseline

      const deptPatients = patients.filter((p) => p.department === dept);
      const waiting = deptPatients.filter((p) => p.status === 'waiting').length;
      const inConsult = deptPatients.filter((p) => p.status === 'in_consultation').length;

      // Avg consultation time (default 12 mins per patient)
      const avgTime =
        deptDoctors.length > 0 && deptDoctors[0].avgConsultationTimeMin
          ? deptDoctors[0].avgConsultationTimeMin
          : 12;

      // Hourly treatment capacity = (doctors * 60) / avgConsultMinutes
      const hourlyCap = Math.round((effectiveActiveDocs * 60) / avgTime);

      // Predictive baseline arrivals next hour:
      // Calibrated from hour of day + current department velocity (transparent statistical baseline)
      const currentHour = new Date().getHours();
      const isPeakHour = (currentHour >= 9 && currentHour <= 13) || (currentHour >= 16 && currentHour <= 19);
      const baseArrivalRate = isPeakHour ? 8 : 4;
      const queueWeight = Math.round(waiting * 0.4);
      const predictedArrivals = Math.max(baseArrivalRate + queueWeight, 2);

      // Wait time calculation: (waiting * avgTime) / activeDocs
      const currentWait = Math.round((waiting * avgTime) / effectiveActiveDocs);

      // Projected queue at end of next hour = currentWaiting + arrivals - hourlyCapacity
      const projectedQueueIn1Hr = Math.max(waiting + predictedArrivals - hourlyCap, 0);
      const projectedWaitIn1Hr = Math.round((projectedQueueIn1Hr * avgTime) / effectiveActiveDocs);

      // Risk thresholds:
      // Low: wait < 20 mins and queue <= 5
      // Medium: wait 20 - 45 mins or queue 6 - 12
      // High: wait > 45 mins or queue > 12
      const evaluateRisk = (waitMins: number, queueLen: number): OvercrowdRiskLevel => {
        if (waitMins > 45 || queueLen > 12) return 'High';
        if (waitMins >= 20 || queueLen >= 6) return 'Medium';
        return 'Low';
      };

      return {
        department: dept,
        activeDoctors: activeDocs,
        totalDoctors: deptDoctors.length,
        waitingCount: waiting,
        inConsultCount: inConsult,
        avgConsultMinutes: avgTime,
        hourlyCapacity: hourlyCap,
        predictedArrivalsNextHour: predictedArrivals,
        currentWaitMinutes: currentWait,
        projectedWaitMinutesNextHour: projectedWaitIn1Hr,
        currentRisk: evaluateRisk(currentWait, waiting),
        projectedRisk: evaluateRisk(projectedWaitIn1Hr, projectedQueueIn1Hr),
      };
    });
  }, [doctors, patients, departmentList, selectedDept]);

  // Aggregate metrics across active selection
  const aggregated = useMemo(() => {
    if (departmentMetrics.length === 0) {
      return {
        totalWaiting: 0,
        totalActiveDocs: 0,
        avgWaitMinutes: 0,
        totalPredictedArrivals: 0,
        maxRisk: 'Low' as OvercrowdRiskLevel,
      };
    }
    const totalWaiting = departmentMetrics.reduce((acc, d) => acc + d.waitingCount, 0);
    const totalActiveDocs = departmentMetrics.reduce((acc, d) => acc + d.activeDoctors, 0);
    const avgWaitMinutes = Math.round(
      departmentMetrics.reduce((acc, d) => acc + d.currentWaitMinutes, 0) / departmentMetrics.length
    );
    const totalPredictedArrivals = departmentMetrics.reduce((acc, d) => acc + d.predictedArrivalsNextHour, 0);

    const hasHigh = departmentMetrics.some((d) => d.currentRisk === 'High' || d.projectedRisk === 'High');
    const hasMed = departmentMetrics.some((d) => d.currentRisk === 'Medium' || d.projectedRisk === 'Medium');
    const maxRisk: OvercrowdRiskLevel = hasHigh ? 'High' : hasMed ? 'Medium' : 'Low';

    return {
      totalWaiting,
      totalActiveDocs,
      avgWaitMinutes,
      totalPredictedArrivals,
      maxRisk,
    };
  }, [departmentMetrics]);

  // What-if Simulation Calculations (100% ephemeral in-memory, NEVER writes to database)
  const simulationResult = useMemo((): SimulationResult | null => {
    if (activeSimulation === 'none') return null;

    const baseWaiting = aggregated.totalWaiting;
    const baseDocs = Math.max(aggregated.totalActiveDocs, 1);
    const avgTime = 12;

    if (activeSimulation === 'surge') {
      const simulatedWaiting = baseWaiting + surgePatientCount;
      const simulatedWait = Math.round((simulatedWaiting * avgTime) / baseDocs);
      const deltaWait = simulatedWait - aggregated.avgWaitMinutes;

      const evalRisk: OvercrowdRiskLevel = simulatedWait > 45 || simulatedWaiting > 12 ? 'High' : simulatedWait >= 20 ? 'Medium' : 'Low';

      return {
        scenarioName: 'surge',
        label: `Simulated Patient Surge (+${surgePatientCount} Acute Arrivals)`,
        simulatedDoctors: baseDocs,
        simulatedWaiting,
        simulatedWaitMinutes: simulatedWait,
        simulatedRisk: evalRisk,
        waitDeltaMinutes: deltaWait,
        queueDelta: surgePatientCount,
        recommendations: [
          'Advisory: Recommend temporarily mobilizing 1 floating physician from General Ward to high-surge clinic.',
          'Advisory: Alert Nursing Triage Bay to batch routine vitals and pre-test orders.',
          'Advisory: Notify OPD reception to guide non-urgent walk-ins toward Virtual OPD / Teleconsult slots.',
        ],
      };
    }

    if (activeSimulation === 'extra_doctor') {
      const simulatedDocs = baseDocs + 1;
      const simulatedWaiting = Math.max(baseWaiting - 3, 0); // expedited queue clearance
      const simulatedWait = Math.round((baseWaiting * avgTime) / simulatedDocs);
      const deltaWait = simulatedWait - aggregated.avgWaitMinutes;

      const evalRisk: OvercrowdRiskLevel = simulatedWait > 45 || baseWaiting > 15 ? 'High' : simulatedWait >= 20 ? 'Medium' : 'Low';

      return {
        scenarioName: 'extra_doctor',
        label: `Simulated Additional Doctor (+1 On-Duty Physician)`,
        simulatedDoctors: simulatedDocs,
        simulatedWaiting: baseWaiting,
        simulatedWaitMinutes: simulatedWait,
        simulatedRisk: evalRisk,
        waitDeltaMinutes: deltaWait,
        queueDelta: 0,
        recommendations: [
          `Advisory: Adding 1 physician cuts patient wait times by ~${Math.abs(deltaWait)} minutes across the department.`,
          'Advisory: Assign relief doctor to Room 205 (Fast-Track Consultation Bay).',
          'Advisory: Authorize shift change only with Chief Medical Officer sign-off.',
        ],
      };
    }

    return null;
  }, [activeSimulation, aggregated, surgePatientCount]);

  // Trigger scenario
  const handleTriggerSurgeSimulation = () => {
    setActiveSimulation('surge');
    playUrgentAlertSound();
    if (onShowToast) {
      onShowToast(
        'Surge Simulation Active',
        `Simulating +${surgePatientCount} acute arrivals. Real database records remain untouched.`,
        'urgent'
      );
    }
  };

  const handleTriggerExtraDoctorSimulation = () => {
    setActiveSimulation('extra_doctor');
    playHospitalChime();
    if (onShowToast) {
      onShowToast(
        'Staffing Simulation Active',
        'Simulating deployment of +1 clinical physician. Live roster unaffected.',
        'success'
      );
    }
  };

  const handleResetSimulation = () => {
    setActiveSimulation('none');
    playHospitalChime();
    if (onShowToast) {
      onShowToast('Simulation Reset', 'Returned to live hospital queue feed.', 'info');
    }
  };

  const handleApproveAction = (actionText: string) => {
    playHospitalChime();
    setApprovedActionNotice(actionText);
    if (onShowToast) {
      onShowToast('Operational Action Approved', 'Action dispatched to hospital nurse station supervisor.', 'success');
    }
    setTimeout(() => setApprovedActionNotice(null), 6000);
  };

  return (
    <div className="card-healthcare p-5 sm:p-7 bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-neutral-800 rounded-3xl space-y-6 shadow-sm">
      {/* SECTION HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-neutral-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-sky-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-black text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight">
                  AI Hospital Overcrowding Predictor
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                  Predictive Analytics Baseline
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Forecasts next-hour arrival volume, estimated delays, and queue risk using real-time patient flow averages.
              </p>
            </div>
          </div>
        </div>

        {/* Department Filter Selector */}
        <div className="flex items-center gap-2 self-start lg:self-center">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
            Department:
          </label>
          <select
            value={selectedDept}
            onChange={(e) => {
              setSelectedDept(e.target.value);
              playHospitalChime();
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="All Departments">All Departments (Consolidated)</option>
            {departmentList.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SUMMARY METRIC CARDS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Current Waiting */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-900/60 border border-slate-200 dark:border-neutral-800 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Waiting Patients</span>
            <Users className="w-4 h-4 text-sky-500" />
          </div>
          <div className="font-mono font-black text-2xl sm:text-3xl text-slate-900 dark:text-white">
            {aggregated.totalWaiting}
            <span className="text-xs font-normal text-slate-500 ml-1">in queue</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Across {departmentMetrics.length} reporting clinic(s)
          </div>
        </div>

        {/* Metric 2: Predicted Arrivals in Next Hour */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-900/60 border border-slate-200 dark:border-neutral-800 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Next-Hour Influx</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="font-mono font-black text-2xl sm:text-3xl text-indigo-600 dark:text-indigo-400">
            +{aggregated.totalPredictedArrivals}
            <span className="text-xs font-normal text-slate-500 ml-1">expected</span>
          </div>
          <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Forecasted for next 60 mins</span>
          </div>
        </div>

        {/* Metric 3: Estimated Waiting Time */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-900/60 border border-slate-200 dark:border-neutral-800 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Est. Waiting Time</span>
            <Clock className="w-4 h-4 text-teal-500" />
          </div>
          <div className="font-mono font-black text-2xl sm:text-3xl text-slate-900 dark:text-white">
            {aggregated.avgWaitMinutes}
            <span className="text-xs font-normal text-slate-500 ml-1">mins</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {aggregated.totalActiveDocs} active physician(s) on duty
          </div>
        </div>

        {/* Metric 4: Overcrowding Risk Badge */}
        <div
          className={`p-4 rounded-2xl border space-y-1 ${
            aggregated.maxRisk === 'High'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-950 dark:text-rose-200'
              : aggregated.maxRisk === 'Medium'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-950 dark:text-amber-200'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-950 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider opacity-80">
            <span>Overcrowding Risk</span>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="font-mono font-black text-2xl sm:text-3xl flex items-center gap-2">
            <span>{aggregated.maxRisk}</span>
            <span
              className={`w-3 h-3 rounded-full animate-pulse ${
                aggregated.maxRisk === 'High'
                  ? 'bg-rose-600'
                  : aggregated.maxRisk === 'Medium'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
            />
          </div>
          <div className="text-[11px] font-semibold">
            {aggregated.maxRisk === 'High'
              ? 'Acute delay threshold exceeded'
              : aggregated.maxRisk === 'Medium'
              ? 'Approaching capacity saturation'
              : 'Flow within optimal bounds'}
          </div>
        </div>
      </div>

      {/* DEPARTMENT BREAKDOWN TABLE */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h4 className="font-heading font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-500" />
            <span>Clinical Department Risk Matrix</span>
          </h4>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Transparent Baseline (Calculated from Current Inflow + Active Doctors)
          </span>
        </div>

        {departmentMetrics.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-neutral-900/60 rounded-2xl border border-dashed border-slate-200 dark:border-neutral-800 text-slate-500">
            <Info className="w-7 h-7 mx-auto text-slate-400 mb-2" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Department Inflow Records</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Live queue is currently clear or no active clinical departments are registered.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-neutral-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-neutral-900/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-neutral-800">
                <tr>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-3">Active Doctors</th>
                  <th className="py-3 px-3">Waiting Patients</th>
                  <th className="py-3 px-3">Est. Wait Time</th>
                  <th className="py-3 px-3">Next 1h Forecast</th>
                  <th className="py-3 px-3">Risk Level</th>
                  <th className="py-3 px-4 text-right">Advisory Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-800 bg-white dark:bg-[#0a0a0c]">
                {departmentMetrics.map((dm) => (
                  <tr key={dm.department} className="hover:bg-slate-50/60 dark:hover:bg-neutral-900/40 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {dm.department}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-mono">
                      {dm.activeDoctors} / {dm.totalDoctors} on duty
                    </td>
                    <td className="py-3 px-3 text-slate-900 dark:text-white font-mono font-bold">
                      {dm.waitingCount} patients
                    </td>
                    <td className="py-3 px-3 font-mono">
                      <span
                        className={`font-bold ${
                          dm.currentWaitMinutes > 40
                            ? 'text-rose-600'
                            : dm.currentWaitMinutes > 20
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        ~{dm.currentWaitMinutes} mins
                      </span>
                    </td>
                    <td className="py-3 px-3 text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                      +{dm.predictedArrivalsNextHour} arrivals
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          dm.projectedRisk === 'High'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300'
                            : dm.projectedRisk === 'Medium'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            dm.projectedRisk === 'High'
                              ? 'bg-rose-600'
                              : dm.projectedRisk === 'Medium'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <span>{dm.projectedRisk} Risk</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handleApproveAction(
                            dm.projectedRisk === 'High'
                              ? `Authorize auxiliary doctor reallocation to ${dm.department}`
                              : dm.projectedRisk === 'Medium'
                              ? `Pre-notify lab triage counter for ${dm.department}`
                              : `Maintain regular OPD roster for ${dm.department}`
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition cursor-pointer"
                      >
                        {dm.projectedRisk === 'High'
                          ? 'Request Relief Doc'
                          : dm.projectedRisk === 'Medium'
                          ? 'Alert Triage Bay'
                          : 'Optimal Flow'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* APPROVED ACTION NOTICE TOAST */}
      {approvedActionNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Supervisor Action Dispatched:</strong> {approvedActionNotice} (Authorized by staff).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setApprovedActionNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =========================================================================
          WHAT-IF SIMULATION ENGINE (Interactive Scenario Analysis)
          ========================================================================= */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/40 dark:from-neutral-900/80 dark:to-indigo-950/20 border border-indigo-100 dark:border-neutral-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h4 className="font-heading font-extrabold text-base text-slate-900 dark:text-white">
                What-If Scenario Simulation
              </h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Simulate hypothetical operational surges or doctor reassignments. Live database records are never modified.
            </p>
          </div>

          {/* Simulation Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleTriggerSurgeSimulation}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                activeSimulation === 'surge'
                  ? 'bg-rose-600 text-white shadow-rose-600/25 ring-2 ring-rose-400'
                  : 'bg-white dark:bg-neutral-800 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 hover:bg-rose-50'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Simulate Patient Surge (+{surgePatientCount})</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerExtraDoctorSimulation}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                activeSimulation === 'extra_doctor'
                  ? 'bg-indigo-600 text-white shadow-indigo-600/25 ring-2 ring-indigo-400'
                  : 'bg-white dark:bg-neutral-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900 hover:bg-indigo-50'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Simulate Additional Doctor (+1 Doc)</span>
            </button>

            {activeSimulation !== 'none' && (
              <button
                type="button"
                onClick={handleResetSimulation}
                className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-neutral-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="Reset to current live situation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Live</span>
              </button>
            )}
          </div>
        </div>

        {/* COMPARISON GRID (Current Situation vs Simulated Situation) */}
        {simulationResult ? (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card A: Current Situation (Before) */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-neutral-800">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Current Live Situation (Before)
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300">
                    LIVE DATA
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-900/60">
                    <span className="text-[10px] text-slate-400 font-bold block">Active Docs</span>
                    <span className="font-mono font-bold text-lg text-slate-900 dark:text-white">
                      {aggregated.totalActiveDocs}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-900/60">
                    <span className="text-[10px] text-slate-400 font-bold block">Waiting Queue</span>
                    <span className="font-mono font-bold text-lg text-slate-900 dark:text-white">
                      {aggregated.totalWaiting}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-900/60">
                    <span className="text-[10px] text-slate-400 font-bold block">Est. Wait</span>
                    <span className="font-mono font-bold text-lg text-slate-900 dark:text-white">
                      {aggregated.avgWaitMinutes}m
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500">Department Overcrowding:</span>
                  <span
                    className={`font-bold ${
                      aggregated.maxRisk === 'High'
                        ? 'text-rose-600'
                        : aggregated.maxRisk === 'Medium'
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {aggregated.maxRisk} Risk
                  </span>
                </div>
              </div>

              {/* Card B: Simulated Situation (After) */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  simulationResult.scenarioName === 'surge'
                    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'
                    : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-neutral-800">
                  <span
                    className={`text-xs font-extrabold uppercase tracking-wider ${
                      simulationResult.scenarioName === 'surge' ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {simulationResult.label}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      simulationResult.scenarioName === 'surge'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                    }`}
                  >
                    SIMULATION
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-neutral-900/80">
                    <span className="text-[10px] text-slate-400 font-bold block">Simulated Docs</span>
                    <span className="font-mono font-bold text-lg text-slate-900 dark:text-white">
                      {simulationResult.simulatedDoctors}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-neutral-900/80">
                    <span className="text-[10px] text-slate-400 font-bold block">Simulated Queue</span>
                    <span className="font-mono font-bold text-lg text-slate-900 dark:text-white">
                      {simulationResult.simulatedWaiting}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/80 dark:bg-neutral-900/80">
                    <span className="text-[10px] text-slate-400 font-bold block">Simulated Wait</span>
                    <span className="font-mono font-bold text-lg text-slate-900 dark:text-white">
                      {simulationResult.simulatedWaitMinutes}m
                    </span>
                  </div>
                </div>

                {/* Impact Delta Bar */}
                <div className="flex items-center justify-between text-xs pt-1 font-semibold">
                  <span className="text-slate-600 dark:text-slate-300">Projected Variance:</span>
                  <span
                    className={`flex items-center gap-1 font-mono font-bold ${
                      simulationResult.waitDeltaMinutes > 0
                        ? 'text-rose-600'
                        : simulationResult.waitDeltaMinutes < 0
                        ? 'text-emerald-600'
                        : 'text-slate-600'
                    }`}
                  >
                    {simulationResult.waitDeltaMinutes > 0 ? (
                      <>
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>+{simulationResult.waitDeltaMinutes} mins delay</span>
                      </>
                    ) : simulationResult.waitDeltaMinutes < 0 ? (
                      <>
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>{simulationResult.waitDeltaMinutes} mins saved</span>
                      </>
                    ) : (
                      <span>No delay variance</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Smart Advisory Recommendations */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0a0a0c] border border-indigo-100 dark:border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span>Explainable Operational Recommendations (Advisory Only):</span>
                </span>
                <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900">
                  Requires authorized human approval before execution
                </span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                {simulationResult.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-indigo-500 font-bold shrink-0 mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500 bg-white dark:bg-[#0a0a0c] rounded-2xl border border-dashed border-slate-200 dark:border-neutral-800 space-y-2">
            <Info className="w-6 h-6 text-indigo-500 mx-auto" />
            <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
              Interactive Scenario Ready
            </div>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Click &quot;Simulate Patient Surge&quot; or &quot;Simulate Additional Doctor&quot; above to project how department queues, waiting times, and overcrowding risks respond to operational shifts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
