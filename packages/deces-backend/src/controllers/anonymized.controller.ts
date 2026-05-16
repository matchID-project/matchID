import { Body, Controller, Delete, Get, Path, Post, Put, Response, Route, Security, Tags } from 'tsoa';
import { listAnonymizedIds, addAnonymizedId, removeAnonymizedId, replaceAnonymizedId } from '../anonymize';
import { ErrorResponse } from '../models/result';

/**
 * @swagger
 * tags:
 *   name: Anonymized
 *   description: Manage the list of person IDs whose records are anonymized in search results
 */
@Route('anonymized')
@Security('jwt', ['admin'])
@Tags('Anonymized')
export class AnonymizedController extends Controller {

  /**
   * List all anonymized IDs
   * @summary Retourner la liste des identifiants anonymisés
   */
  @Response<AnonymizedListResponse>('200', 'OK')
  @Get('/')
  public list(): AnonymizedListResponse {
    return { ids: listAnonymizedIds() };
  }

  /**
   * Add an ID to the anonymized list
   * @summary Ajouter un identifiant à la liste des anonymisés
   */
  @Response<AnonymizedResponse>('200', 'OK')
  @Response<ErrorResponse>('409', 'Already exists')
  @Post('/')
  public add(@Body() body: AnonymizedIdRequest): AnonymizedResponse {
    const added = addAnonymizedId(body.id);
    if (!added) {
      this.setStatus(409);
      return { msg: `ID ${body.id} is already in the anonymized list` };
    }
    return { msg: `ID ${body.id} added to the anonymized list` };
  }

  /**
   * Remove an ID from the anonymized list
   * @summary Supprimer un identifiant de la liste des anonymisés
   * @param id Person unique identifier to remove
   */
  @Response<AnonymizedResponse>('200', 'OK')
  @Response<ErrorResponse>('404', 'Not found')
  @Delete('/{id}')
  public remove(@Path() id: string): AnonymizedResponse {
    const removed = removeAnonymizedId(id);
    if (!removed) {
      this.setStatus(404);
      return { msg: `ID ${id} not found in the anonymized list` };
    }
    return { msg: `ID ${id} removed from the anonymized list` };
  }

  /**
   * Replace an existing ID with a new one
   * @summary Remplacer un identifiant par un autre dans la liste des anonymisés
   * @param id Person unique identifier to replace
   */
  @Response<AnonymizedResponse>('200', 'OK')
  @Response<ErrorResponse>('404', 'Not found')
  @Put('/{id}')
  public update(@Path() id: string, @Body() body: AnonymizedIdRequest): AnonymizedResponse {
    const replaced = replaceAnonymizedId(id, body.id);
    if (!replaced) {
      this.setStatus(404);
      return { msg: `ID ${id} not found in the anonymized list` };
    }
    return { msg: `ID ${id} replaced with ${body.id}` };
  }
}

/**
 * @tsoaModel
 * @example
 * { "id": "ba7582a6344757e67351bf42096c952a12108e06" }
 */
interface AnonymizedIdRequest {
  id: string;
}

/**
 * @tsoaModel
 * @example
 * { "ids": ["ba7582a6344757e67351bf42096c952a12108e06"] }
 */
interface AnonymizedListResponse {
  ids: string[];
}

/**
 * @tsoaModel
 * @example
 * { "msg": "ID ba7582a6344757e67351bf42096c952a12108e06 added to the anonymized list" }
 */
interface AnonymizedResponse {
  msg: string;
}
