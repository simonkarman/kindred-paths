
export class Configuration {
  readonly port;

  readonly collectionRootDir;
  readonly cacheRootDir;

  readonly cardsDir;
  readonly artDir;
  readonly artSuggestionsDir;
  readonly setsDir;
  readonly symbolDir;

  readonly rendersCacheDir;
  readonly previewsCacheDir;
  readonly generatorsCacheDir;

  constructor() {
    this.port = process.env.PORT || '4101';

    // Collection directories
    this.collectionRootDir = process.env.COLLECTION_ROOT_DIR ?? '../collection';
    this.cardsDir = `${this.collectionRootDir}/cards`;
    this.artDir = `${this.collectionRootDir}/art`;
    this.artSuggestionsDir = `${this.artDir}/suggestions`;
    this.setsDir = `${this.collectionRootDir}/sets`;
    this.symbolDir = `${this.collectionRootDir}/symbols`;

    // Cache directories
    this.cacheRootDir = process.env.CACHE_ROOT_DIR ?? './.cache';
    this.rendersCacheDir = `${this.cacheRootDir}/renders`;
    this.previewsCacheDir = `${this.cacheRootDir}/previews`;
    this.generatorsCacheDir = `${this.cacheRootDir}/generators`;
  }
}

export const configuration = new Configuration();
