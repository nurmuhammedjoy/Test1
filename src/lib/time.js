// Formats seconds as HH:MM:SS for the player scrubber.
export function formatTime(timeInSeconds) {
  if (Number.isNaN(timeInSeconds)) return '00:00:00';

  const hrs = Math.floor(timeInSeconds / 3600);
  const mins = Math.floor((timeInSeconds % 3600) / 60);
  const secs = Math.floor(timeInSeconds % 60);

  return [hrs, mins, secs].map((n) => n.toString().padStart(2, '0')).join(':');
}
