/**
 * Utilidades para formatear horarios de trabajo
 */

interface Schedule {
  day: number;
  enabled: boolean;
  is_continuous: boolean;
  start_time: string;
  end_time: string;
  morning_start: string | null;
  morning_end: string | null;
  afternoon_start: string | null;
  afternoon_end: string | null;
}

const DAYS = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo'
];

const DAYS_SHORT = [
  'Lun',
  'Mar',
  'Mié',
  'Jue',
  'Vie',
  'Sáb',
  'Dom'
];

/**
 * Formatea una hora de formato TIME (HH:MM:SS) a formato legible (HH:MM)
 */
function formatTime(time: string | null): string {
  if (!time) return '';
  // Si viene en formato HH:MM:SS, tomar solo HH:MM
  return time.substring(0, 5);
}

/**
 * Formatea los horarios de una tienda en texto legible
 */
export function formatScheduleText(schedules: Schedule[]): string {
  const enabledSchedules = schedules.filter(s => s.enabled);
  
  if (enabledSchedules.length === 0) {
    return 'Sin horarios configurados';
  }

  // Agrupar días consecutivos con el mismo horario
  const groups: Array<{
    days: number[];
    schedule: Schedule;
  }> = [];

  enabledSchedules.forEach(schedule => {
    const scheduleKey = schedule.is_continuous
      ? `continuous-${schedule.start_time}-${schedule.end_time}`
      : `split-${schedule.morning_start}-${schedule.morning_end}-${schedule.afternoon_start}-${schedule.afternoon_end}`;

    const existingGroup = groups.find(g => {
      const gKey = g.schedule.is_continuous
        ? `continuous-${g.schedule.start_time}-${g.schedule.end_time}`
        : `split-${g.schedule.morning_start}-${g.schedule.morning_end}-${g.schedule.afternoon_start}-${g.schedule.afternoon_end}`;
      return gKey === scheduleKey;
    });

    if (existingGroup) {
      existingGroup.days.push(schedule.day);
    } else {
      groups.push({
        days: [schedule.day],
        schedule
      });
    }
  });

  // Formatear cada grupo
  const formattedGroups = groups.map(group => {
    const daysText = formatDaysRange(group.days);
    const hoursText = formatHours(group.schedule);
    return `${daysText}: ${hoursText}`;
  });

  return formattedGroups.join('\n');
}

/**
 * Formatea un rango de días (ej: "Lun - Vie" o "Lun, Mié, Vie")
 */
function formatDaysRange(days: number[]): string {
  if (days.length === 0) return '';
  if (days.length === 1) return DAYS[days[0]];

  // Ordenar días
  const sortedDays = [...days].sort((a, b) => a - b);

  // Si son días consecutivos, usar rango
  const isConsecutive = sortedDays.every((day, index) => {
    if (index === 0) return true;
    return day === sortedDays[index - 1] + 1;
  });

  if (isConsecutive && sortedDays.length > 1) {
    if (sortedDays.length === 2) {
      return `${DAYS_SHORT[sortedDays[0]]} - ${DAYS_SHORT[sortedDays[1]]}`;
    }
    return `${DAYS_SHORT[sortedDays[0]]} - ${DAYS_SHORT[sortedDays[sortedDays.length - 1]]}`;
  }

  // Si no son consecutivos, listar todos
  return sortedDays.map(d => DAYS_SHORT[d]).join(', ');
}

/**
 * Formatea las horas de un horario (continuo o partido)
 */
function formatHours(schedule: Schedule): string {
  if (schedule.is_continuous) {
    return `${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`;
  } else {
    const morning = `${formatTime(schedule.morning_start)} - ${formatTime(schedule.morning_end)}`;
    const afternoon = `${formatTime(schedule.afternoon_start)} - ${formatTime(schedule.afternoon_end)}`;
    return `${morning} / ${afternoon}`;
  }
}

/**
 * Formatea los horarios en formato HTML/JSX para mostrar en la página
 */
export function formatScheduleHTML(schedules: Schedule[]): Array<{
  day: string;
  hours: string;
}> {
  const enabledSchedules = schedules
    .filter(s => s.enabled)
    .sort((a, b) => a.day - b.day);

  return enabledSchedules.map(schedule => ({
    day: DAYS[schedule.day],
    hours: formatHours(schedule)
  }));
}
