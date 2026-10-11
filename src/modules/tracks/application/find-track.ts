import { type Result, forbidden, notFound, ok } from '#shared/domain/result';
import { NOT_A_TUTOR, TRACK_NOT_FOUND, type TrackRecord, type TrackRepository, isTutorOf } from '../domain/track';

// A trilha que um tutor (`actorId`) vai editar: 404 se não existe, 403 se ele não é tutor dela.
export async function findEditableTrack(tracks: TrackRepository, trackId: number, actorId: number): Promise<Result<TrackRecord>> {
  const track = await tracks.findById(trackId);
  if (!track) return notFound(TRACK_NOT_FOUND);
  return isTutorOf(track, actorId) ? ok(track) : forbidden(NOT_A_TUTOR);
}
