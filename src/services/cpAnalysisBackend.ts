import { CP4ResponseError, parseCP4JSON, responseMime, type CP4ResponseInfo } from './cpAnalysisResponse';

// A generic status:ok (or a preview shell) does not identify our Express backend.
export const CP4_BACKEND_SERVICE = 'administrasi-guru-ai';
export const CP4_BACKEND_PROTOCOL = 1;
export async function checkCP4Backend(signal: AbortSignal, requestId: string): Promise<void> {
  const info: CP4ResponseInfo = {source:'endpoint',reason:'CONTRACT',phase:'health'};
  try {
    const res = await fetch('/api/health', {method:'GET',cache:'no-store',redirect:'error',signal,
      headers:{Accept:'application/json','X-CP4-Request-ID':requestId}});
    info.httpStatus=res.status;info.mime=responseMime(res.headers.get('Content-Type'));
    if(!res.ok)throw new CP4ResponseError({...info,reason:'HTTP_ERROR'});
    if(info.mime!=='json')throw new CP4ResponseError({...info,reason:info.mime==='html'?'HTML':'CONTENT_TYPE'});
    const body=parseCP4JSON(await res.text(),info,false);
    if(body.status!=='ok'||body.service!==CP4_BACKEND_SERVICE||body.cpAnalysisProtocol!==CP4_BACKEND_PROTOCOL||body.requestId!==requestId)
      throw new CP4ResponseError(info);
  } catch(error) {
    if(signal.aborted)throw error;
    if(error instanceof CP4ResponseError)throw error;
    // Never retain a redirect destination, HTML, headers, credentials or raw network error.
    throw new CP4ResponseError({...info,reason:'NETWORK_ERROR'});
  }
}
