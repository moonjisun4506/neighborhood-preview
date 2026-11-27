'use client';
import {createContext,useContext,useEffect,useState,type Dispatch,type ReactNode,type SetStateAction} from 'react';
import {usePathname} from 'next/navigation';
import {useApp} from './app-provider';
// One selection shared by list rows and map markers: "facility:<id>" or "station:<id>".
type Selection={selectedPlaceId:string|null;selectPlace:Dispatch<SetStateAction<string|null>>};
const Context=createContext<Selection>(null!);
export const facilityPrefix='facility:',stationPrefix='station:';
export function SelectionProvider({children}:{children:ReactNode}){
  const {selected}=useApp();const pathname=usePathname();const [selectedPlaceId,selectPlace]=useState<string|null>(null);
  // A new house (or a different tab) never inherits the previous selection.
  useEffect(()=>{selectPlace(null);},[selected?.id,selected?.coordinates?.lat,selected?.coordinates?.lng,pathname]);
  return <Context.Provider value={{selectedPlaceId,selectPlace}}>{children}</Context.Provider>;
}
export const useSelection=()=>useContext(Context);
/** Returns the id inside the selection when it belongs to the given prefix. */
export function selectedIdFor(selection:string|null,prefix:string){return selection?.startsWith(prefix)?selection.slice(prefix.length):null;}
