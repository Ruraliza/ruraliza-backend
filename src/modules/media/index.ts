// API pública do módulo de fotos: o único arquivo que outros módulos enxergam (#modules/media).
export type { PhotoRoutes } from './presentation/photo.routes';
export { type MediaModuleDeps, type PhotoUseCases, createPhotoRoutes, createPhotoUseCases } from './media.module';
