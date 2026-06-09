import { Controller, Get, Route, Response, Tags } from 'tsoa';
import { HealthcheckResponse, ReadinessResponse } from '../models/result';
import { checkClientHealth, getClient, getSearchIndex } from '../elasticsearch';
import { checkRedisHealth } from '../redisClient';
import loggerStream from '../logger';

interface DecesRecord {
  DATE_DECES: string;
  SOURCE: string;
}

/**
 * @swagger
 * tags:
 *   name: Check
 *   description: Vérification status du backend
 */
@Route('')
export class StatusController extends Controller {

  /**
   * Health check endpoint
   * @summary Requête utilise pour vérifier le bon fonctionnement du backend
   */
  @Response<HealthcheckResponse>('200', 'OK')
  @Tags('Check')
  @Get('/healthcheck')
  public msg(): HealthcheckResponse {
    return { msg: 'OK' };
  }

  /**
   * Readiness check endpoint
   * @summary Vérifie que les dépendances runtime du backend sont joignables
   */
  @Response<ReadinessResponse>('200', 'OK')
  @Response<ReadinessResponse>('503', 'Unavailable')
  @Tags('Check')
  @Get('/readiness')
  public async readiness(): Promise<ReadinessResponse> {
    const [elasticsearch, redis] = await Promise.all([
      checkClientHealth(),
      checkRedisHealth(),
    ]);
    const ready = elasticsearch && redis;

    this.setStatus(ready ? 200 : 503);
    return {
      msg: ready ? 'OK' : 'Unavailable',
      dependencies: {
        elasticsearch,
        redis,
      },
    };
  }

  /**
   * Backend version endpoint
   * @summary Obtenir la version du backend
   */
  @Tags('Info')
  @Get('/version')
  public async version(): Promise<any> {
    try {
      const client = getClient();
      const index = getSearchIndex();

      const countResponse = await client.count({
        index
      });
      const uniqRecordsCount = countResponse.count;

      let lastRecordDate: string;
      let lastDataset: string;
      const searchResponse = await client.search({
        index,
        body: {
          sort: [
            { SOURCE: 'desc' },
            { 'DATE_DECES.raw': 'desc' }
          ],
          size: 1
        } as any
      });

      if (searchResponse.hits.hits.length > 0) {
        const source = searchResponse.hits.hits[0]._source as DecesRecord;
        lastRecordDate = source.DATE_DECES.replace(/(\d{4})(\d{2})(\d{2})/,"$3/$2/$1");
        lastDataset = source.SOURCE;
      }

      let updateDate: string;
      const indicesResponse = await client.cat.indices({
        index,
        format: 'json',
        h: 'creation.date.string'
      });

      if (indicesResponse.length > 0) {
        updateDate = indicesResponse[0]['creation.date.string']
          .trim()
          .replace(/T.*/,'')
          .replaceAll('-','')
          .replace(/(\d{4})(\d{2})(\d{2})/,"$3/$2/$1");
      }

      return {
        backend: process.env.APP_VERSION,
        uniqRecordsCount,
        lastRecordDate,
        lastDataset,
        updateDate
      };
    } catch (error) {
      loggerStream.write(JSON.stringify({
        "backend": {
          "server-date": new Date(Date.now()).toISOString(),
          "error": error.toString(),
          "msg": "Error fetching version info"
        }
      }));
      return {
        backend: process.env.APP_VERSION,
        error: 'Failed to fetch Elasticsearch data'
      };
    }
  }
}
