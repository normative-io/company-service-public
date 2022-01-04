import { NaceIsicMapping } from './naceisicmapping.model';
import * as mapping from './isicmapping.json';

/*
 In-memory repository nace to isic mapping.

 It is assumed that this might be replaced with database backed
 repositories at some point in the future, so the interface is 
 asynchronous in order for it not to break when a new implementation
 is introduced.
 */
export class NaceIsicMappingRepository {
  async findByNace(nace: string): Promise<NaceIsicMapping | undefined> {
    return mapping.filter((record) => record.nace === nace).shift();
  }
}
