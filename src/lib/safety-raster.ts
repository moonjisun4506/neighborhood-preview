export type SafetyRaster={pixels:number;visiblePixels:number;legendPixels:number;maxAlpha:number;status:'transparent'|'legend_colors'|'unclassified'};
// Image diagnostics only: pixels are never interpreted as crimes, incidents or risk scores.
export function inspectSafetyRaster(rgba:ArrayLike<number>,legend:{color:string}[]):SafetyRaster{
  const colors=new Set(legend.filter(v=>/^#[\da-f]{6}$/i.test(v.color)).map(v=>parseInt(v.color.slice(1),16)));let visiblePixels=0,legendPixels=0,maxAlpha=0;
  for(let i=0;i+3<rgba.length;i+=4){const alpha=rgba[i+3];maxAlpha=Math.max(maxAlpha,alpha);if(!alpha)continue;visiblePixels++;if(colors.has((rgba[i]<<16)|(rgba[i+1]<<8)|rgba[i+2]))legendPixels++;}
  return {pixels:Math.floor(rgba.length/4),visiblePixels,legendPixels,maxAlpha,status:!visiblePixels?'transparent':legendPixels?'legend_colors':'unclassified'};
}
