import {tmapInput,tmapResponse,tmapFailure} from '@/lib/tmap-route.server';
import {tmapWalking} from '@/lib/tmap.server';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){try{const {origin,destination}=await tmapInput(request);return tmapResponse(await tmapWalking(origin,destination));}catch(error){return tmapFailure(error);}}
