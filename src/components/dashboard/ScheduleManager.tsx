import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const DAYS = [
  { index: 0, name: 'Lunes', short: 'Lun' },
  { index: 1, name: 'Martes', short: 'Mar' },
  { index: 2, name: 'Miércoles', short: 'Mié' },
  { index: 3, name: 'Jueves', short: 'Jue' },
  { index: 4, name: 'Viernes', short: 'Vie' },
  { index: 5, name: 'Sábado', short: 'Sáb' },
  { index: 6, name: 'Domingo', short: 'Dom' }
]

interface Schedule {
  day: number
  enabled: boolean
  is_continuous: boolean
  start_time: string
  end_time: string
  morning_start: string
  morning_end: string
  afternoon_start: string
  afternoon_end: string
  slot_duration: number
}

interface DayOff {
  id: string
  date: string
  reason: string
}

export default function ScheduleManager() {
  const [store, setStore] = useState<any>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [daysOff, setDaysOff] = useState<DayOff[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'schedule' | 'daysoff'>('schedule')
  
  // Form para día libre individual
  const [addMode, setAddMode] = useState<'single' | 'range'>('single')
  const [newDayOffDate, setNewDayOffDate] = useState('')
  const [newDayOffReason, setNewDayOffReason] = useState('')
  const [rangeStartDate, setRangeStartDate] = useState('')
  const [rangeEndDate, setRangeEndDate] = useState('')
  const [addingDayOff, setAddingDayOff] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/login'; return }

      const { data: storeData } = await supabase.from('stores').select('*').eq('user_id', session.user.id).single()
      if (!storeData || storeData.store_type !== 'appointments') { window.location.href = '/dashboard'; return }

      setStore(storeData)
      
      const [schedulesRes, daysOffRes] = await Promise.all([
        supabase.from('schedules').select('*').eq('store_id', storeData.id),
        supabase.from('days_off').select('*').eq('store_id', storeData.id).order('date', { ascending: true })
      ])

      const defaultSchedules: Schedule[] = DAYS.map(day => {
        const existing = schedulesRes.data?.find(s => s.day === day.index)
        return {
          day: day.index,
          enabled: existing?.enabled ?? (day.index < 5),
          is_continuous: existing?.is_continuous ?? true,
          start_time: existing?.start_time || '09:00',
          end_time: existing?.end_time || '18:00',
          morning_start: existing?.morning_start || '09:00',
          morning_end: existing?.morning_end || '13:00',
          afternoon_start: existing?.afternoon_start || '16:00',
          afternoon_end: existing?.afternoon_end || '20:00',
          slot_duration: existing?.slot_duration || 30
        }
      })
      setSchedules(defaultSchedules)
      setDaysOff(daysOffRes.data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  function updateSchedule(dayIndex: number, field: keyof Schedule, value: any) {
    setSchedules(prev => prev.map(s => s.day === dayIndex ? { ...s, [field]: value } : s))
    setSaved(false)
  }

  async function handleSaveSchedules() {
    setSaving(true)
    try {
      await supabase.from('schedules').delete().eq('store_id', store.id)
      await supabase.from('schedules').insert(schedules.map(s => ({ ...s, store_id: store.id })))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error:', error)
      alert('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddSingleDayOff(e: React.FormEvent) {
    e.preventDefault()
    if (!newDayOffDate) return
    
    setAddingDayOff(true)
    try {
      const { data, error } = await supabase.from('days_off').insert({
        store_id: store.id,
        date: newDayOffDate,
        reason: newDayOffReason.trim() || null
      }).select().single()
      
      if (error) throw error
      
      setDaysOff([...daysOff, data].sort((a, b) => a.date.localeCompare(b.date)))
      setNewDayOffDate('')
      setNewDayOffReason('')
    } catch (error: any) {
      if (error.code === '23505') {
        alert('Ya existe un día libre en esa fecha')
      } else {
        console.error('Error:', error)
        alert('Error al agregar')
      }
    } finally {
      setAddingDayOff(false)
    }
  }

  async function handleAddRangeDaysOff(e: React.FormEvent) {
    e.preventDefault()
    if (!rangeStartDate || !rangeEndDate) return
    
    setAddingDayOff(true)
    try {
      // Generar todas las fechas en el rango
      const dates: { store_id: string; date: string; reason: string | null }[] = []
      const start = new Date(rangeStartDate + 'T12:00:00')
      const end = new Date(rangeEndDate + 'T12:00:00')
      
      if (start > end) {
        alert('La fecha de inicio debe ser anterior a la fecha de fin')
        setAddingDayOff(false)
        return
      }

      const current = new Date(start)
      while (current <= end) {
        dates.push({
          store_id: store.id,
          date: current.toISOString().split('T')[0],
          reason: newDayOffReason.trim() || null
        })
        current.setDate(current.getDate() + 1)
      }

      // Insertar todas las fechas (ignorar duplicados)
      const { data, error } = await supabase
        .from('days_off')
        .upsert(dates, { onConflict: 'store_id,date', ignoreDuplicates: true })
        .select()

      if (error) throw error

      // Recargar datos
      const { data: refreshedData } = await supabase
        .from('days_off')
        .select('*')
        .eq('store_id', store.id)
        .order('date', { ascending: true })
      
      setDaysOff(refreshedData || [])
      setRangeStartDate('')
      setRangeEndDate('')
      setNewDayOffReason('')
    } catch (error: any) {
      console.error('Error:', error)
      alert('Error al agregar el rango')
    } finally {
      setAddingDayOff(false)
    }
  }

  async function handleDeleteDayOff(id: string) {
    try {
      await supabase.from('days_off').delete().eq('id', id)
      setDaysOff(daysOff.filter(d => d.id !== id))
    } catch (error) {
      console.error('Error:', error)
    }
  }

  async function handleDeleteRange(startDate: string, reason: string | null) {
    if (!confirm(`¿Eliminar todos los días ${reason ? `de "${reason}"` : 'de este período'}?`)) return
    
    try {
      // Encontrar todos los días consecutivos con el mismo motivo
      const toDelete = daysOff.filter(d => {
        if (reason) return d.reason === reason
        return d.date >= startDate
      }).map(d => d.id)

      await supabase.from('days_off').delete().in('id', toDelete)
      setDaysOff(daysOff.filter(d => !toDelete.includes(d.id)))
    } catch (error) {
      console.error('Error:', error)
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  function formatDateLong(dateStr: string) {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  function isPastDate(dateStr: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const date = new Date(dateStr + 'T12:00:00')
    return date < today
  }

  // Agrupar días libres por razón/período
  function groupDaysOff() {
    const groups: { reason: string | null; dates: DayOff[]; startDate: string; endDate: string }[] = []
    let currentGroup: DayOff[] = []
    let currentReason: string | null = null

    daysOff.forEach((day, index) => {
      const prevDay = index > 0 ? daysOff[index - 1] : null
      
      // Verificar si es consecutivo y tiene el mismo motivo
      const isConsecutive = prevDay && 
        new Date(day.date).getTime() - new Date(prevDay.date).getTime() === 86400000 &&
        day.reason === prevDay.reason

      if (isConsecutive) {
        currentGroup.push(day)
      } else {
        if (currentGroup.length > 0) {
          groups.push({
            reason: currentReason,
            dates: currentGroup,
            startDate: currentGroup[0].date,
            endDate: currentGroup[currentGroup.length - 1].date
          })
        }
        currentGroup = [day]
        currentReason = day.reason
      }
    })

    if (currentGroup.length > 0) {
      groups.push({
        reason: currentReason,
        dates: currentGroup,
        startDate: currentGroup[0].date,
        endDate: currentGroup[currentGroup.length - 1].date
      })
    }

    return groups
  }

  const today = new Date().toISOString().split('T')[0]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  const activeDays = schedules.filter(s => s.enabled).length
  const upcomingDaysOff = daysOff.filter(d => !isPastDate(d.date))
  const groupedDaysOff = groupDaysOff()

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Mis Horarios</h1>
        <p className="text-gray-500 mt-1">Configura cuándo atiendes a tus clientes</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
            activeTab === 'schedule'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Horario semanal
        </button>
        <button
          onClick={() => setActiveTab('daysoff')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
            activeTab === 'daysoff'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Días libres {upcomingDaysOff.length > 0 && `(${upcomingDaysOff.length})`}
        </button>
      </div>

      {/* Tab: Horario semanal */}
      {activeTab === 'schedule' && (
        <>
          {/* Resumen */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 mb-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm">Días activos</p>
                <p className="text-4xl font-bold mt-1">{activeDays}</p>
              </div>
              <div className="flex gap-1">
                {DAYS.map((day) => {
                  const schedule = schedules.find(s => s.day === day.index)
                  return (
                    <div
                      key={day.index}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                        schedule?.enabled ? 'bg-white/30' : 'bg-white/10'
                      }`}
                    >
                      {day.short.charAt(0)}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Lista de días */}
          <div className="space-y-3">
            {DAYS.map(day => {
              const schedule = schedules.find(s => s.day === day.index)!
              
              return (
                <div
                  key={day.index}
                  className={`bg-white rounded-2xl border-2 transition-all ${
                    schedule.enabled ? 'border-indigo-100 shadow-sm' : 'border-gray-100'
                  }`}
                >
                  <div className="p-4">
                    {/* Fila principal */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateSchedule(day.index, 'enabled', !schedule.enabled)}
                          className={`relative w-14 h-8 rounded-full transition-colors ${
                            schedule.enabled ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${
                              schedule.enabled ? 'left-7' : 'left-1'
                            }`}
                          />
                        </button>
                        <div>
                          <span className="font-semibold text-gray-900">{day.name}</span>
                          {!schedule.enabled && (
                            <span className="text-sm text-gray-400 ml-2">Cerrado</span>
                          )}
                        </div>
                      </div>

                      {schedule.enabled && (
                        <select
                          value={schedule.slot_duration}
                          onChange={(e) => updateSchedule(day.index, 'slot_duration', parseInt(e.target.value))}
                          className="bg-gray-50 border-0 rounded-lg px-3 py-2 text-sm text-gray-600 focus:ring-0"
                        >
                          <option value="15">15 min</option>
                          <option value="30">30 min</option>
                          <option value="45">45 min</option>
                          <option value="60">1 hora</option>
                        </select>
                      )}
                    </div>

                    {schedule.enabled && (
                      <div className="pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-gray-600">Horario de corrido</span>
                          <button
                            onClick={() => updateSchedule(day.index, 'is_continuous', !schedule.is_continuous)}
                            className={`relative w-12 h-7 rounded-full transition-colors ${
                              schedule.is_continuous ? 'bg-indigo-600' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${
                                schedule.is_continuous ? 'left-6' : 'left-1'
                              }`}
                            />
                          </button>
                        </div>

                        {schedule.is_continuous ? (
                          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3">
                            <input
                              type="time"
                              value={schedule.start_time}
                              onChange={(e) => updateSchedule(day.index, 'start_time', e.target.value)}
                              className="bg-transparent border-0 text-sm font-medium text-gray-700 focus:ring-0 w-24"
                            />
                            <span className="text-gray-400">→</span>
                            <input
                              type="time"
                              value={schedule.end_time}
                              onChange={(e) => updateSchedule(day.index, 'end_time', e.target.value)}
                              className="bg-transparent border-0 text-sm font-medium text-gray-700 focus:ring-0 w-24"
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-400 w-16">Mañana</span>
                              <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-4 py-2.5 flex-1">
                                <input
                                  type="time"
                                  value={schedule.morning_start}
                                  onChange={(e) => updateSchedule(day.index, 'morning_start', e.target.value)}
                                  className="bg-transparent border-0 text-sm font-medium text-gray-700 focus:ring-0 w-24"
                                />
                                <span className="text-gray-400">→</span>
                                <input
                                  type="time"
                                  value={schedule.morning_end}
                                  onChange={(e) => updateSchedule(day.index, 'morning_end', e.target.value)}
                                  className="bg-transparent border-0 text-sm font-medium text-gray-700 focus:ring-0 w-24"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-400 w-16">Tarde</span>
                              <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-4 py-2.5 flex-1">
                                <input
                                  type="time"
                                  value={schedule.afternoon_start}
                                  onChange={(e) => updateSchedule(day.index, 'afternoon_start', e.target.value)}
                                  className="bg-transparent border-0 text-sm font-medium text-gray-700 focus:ring-0 w-24"
                                />
                                <span className="text-gray-400">→</span>
                                <input
                                  type="time"
                                  value={schedule.afternoon_end}
                                  onChange={(e) => updateSchedule(day.index, 'afternoon_end', e.target.value)}
                                  className="bg-transparent border-0 text-sm font-medium text-gray-700 focus:ring-0 w-24"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Botón guardar */}
          <div className="mt-8 flex items-center justify-between">
            {saved ? (
              <span className="flex items-center gap-2 text-green-600 font-medium">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Guardado
              </span>
            ) : <div />}
            <button
              onClick={handleSaveSchedules}
              disabled={saving}
              className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-200"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </>
      )}

      {/* Tab: Días libres */}
      {activeTab === 'daysoff' && (
        <>
          {/* Info */}
          <div className="bg-amber-50 rounded-2xl p-4 mb-6">
            <div className="flex gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-amber-900">Días libres, feriados y vacaciones</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Los clientes no podrán reservar en estas fechas.
                </p>
              </div>
            </div>
          </div>

          {/* Selector de modo */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setAddMode('single')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
                  addMode === 'single'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Un día
              </button>
              <button
                type="button"
                onClick={() => setAddMode('range')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
                  addMode === 'range'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Vacaciones / Rango de fechas
              </button>
            </div>

            {addMode === 'single' ? (
              <form onSubmit={handleAddSingleDayOff} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Fecha *</label>
                    <input
                      type="date"
                      required
                      min={today}
                      value={newDayOffDate}
                      onChange={(e) => setNewDayOffDate(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-0"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Motivo (opcional)</label>
                    <input
                      type="text"
                      value={newDayOffReason}
                      onChange={(e) => setNewDayOffReason(e.target.value)}
                      placeholder="Ej: Feriado"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-0"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={addingDayOff || !newDayOffDate}
                      className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {addingDayOff ? '...' : 'Agregar'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddRangeDaysOff} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Desde *</label>
                    <input
                      type="date"
                      required
                      min={today}
                      value={rangeStartDate}
                      onChange={(e) => setRangeStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Hasta *</label>
                    <input
                      type="date"
                      required
                      min={rangeStartDate || today}
                      value={rangeEndDate}
                      onChange={(e) => setRangeEndDate(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Motivo (opcional)</label>
                  <input
                    type="text"
                    value={newDayOffReason}
                    onChange={(e) => setNewDayOffReason(e.target.value)}
                    placeholder="Ej: Vacaciones de verano"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-0"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingDayOff || !rangeStartDate || !rangeEndDate}
                  className="w-full px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {addingDayOff ? 'Agregando...' : 'Agregar período de vacaciones'}
                </button>
              </form>
            )}
          </div>

          {/* Lista agrupada */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">
                Días programados {upcomingDaysOff.length > 0 && `(${upcomingDaysOff.length})`}
              </h3>
            </div>
            
            {groupedDaysOff.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-500">No hay días libres programados</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {groupedDaysOff.map((group, index) => {
                  const isPast = isPastDate(group.endDate)
                  const isRange = group.dates.length > 1
                  
                  return (
                    <div
                      key={index}
                      className={`px-5 py-4 ${isPast ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${
                            isPast ? 'bg-gray-100' : isRange ? 'bg-orange-50' : 'bg-red-50'
                          }`}>
                            {isRange ? (
                              <>
                                <span className={`text-lg font-bold ${isPast ? 'text-gray-400' : 'text-orange-600'}`}>
                                  {group.dates.length}
                                </span>
                                <span className={`text-xs ${isPast ? 'text-gray-400' : 'text-orange-500'}`}>
                                  días
                                </span>
                              </>
                            ) : (
                              <>
                                <span className={`text-lg font-bold ${isPast ? 'text-gray-400' : 'text-red-600'}`}>
                                  {new Date(group.startDate + 'T12:00:00').getDate()}
                                </span>
                                <span className={`text-xs ${isPast ? 'text-gray-400' : 'text-red-500'}`}>
                                  {new Date(group.startDate + 'T12:00:00').toLocaleDateString('es', { month: 'short' })}
                                </span>
                              </>
                            )}
                          </div>
                          <div>
                            {isRange ? (
                              <>
                                <p className={`font-medium ${isPast ? 'text-gray-400' : 'text-gray-900'}`}>
                                  {formatDate(group.startDate)} → {formatDate(group.endDate)}
                                </p>
                                {group.reason && (
                                  <p className="text-sm text-orange-600 font-medium">{group.reason}</p>
                                )}
                              </>
                            ) : (
                              <>
                                <p className={`font-medium capitalize ${isPast ? 'text-gray-400' : 'text-gray-900'}`}>
                                  {formatDateLong(group.startDate)}
                                </p>
                                {group.reason && (
                                  <p className="text-sm text-gray-500">{group.reason}</p>
                                )}
                              </>
                            )}
                            {isPast && (
                              <span className="text-xs text-gray-400">Pasado</span>
                            )}
                          </div>
                        </div>
                        
                        {isRange ? (
                          <button
                            onClick={() => group.dates.forEach(d => handleDeleteDayOff(d.id))}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar período"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDeleteDayOff(group.dates[0].id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
