import { type Result, forbidden, notFound, ok } from '#shared/domain/result';
import { NOT_A_TUTOR, TRACK_NOT_FOUND, type TrackActor, type TrackRecord, type TrackRepository, canEdit } from '../domain/track';

// A trilha que alguém vai editar: 404 se não existe, 403 se não é tutor dela nem administrador.
export async function findEditableTrack(tracks: TrackRepository, trackId: number, actor: TrackActor): Promise<Result<TrackRecord>> {
  const track = await tracks.findById(trackId);
  if (!track) return notFound(TRACK_NOT_FOUND);
  return canEdit(track, actor) ? ok(track) : forbidden(NOT_A_TUTOR);
}
