import type {Metadata} from 'next';
import {MemoPanelProvider} from '@/components/memo-panel';
import {AppProvider} from '@/components/app-provider';
import {FacilitiesProvider} from '@/components/facilities-provider';
import {SafetyProvider} from '@/components/safety-provider';
import {NoiseProvider} from '@/components/noise-provider';
import {TransitProvider} from '@/components/transit-provider';
import {Header,Footer,DemoBanner} from '@/components/shell';
import './globals.css';
export const metadata:Metadata={title:{default:'동네 미리보기',template:'%s | 동네 미리보기'},description:'직접 선택한 집 주소 주변의 생활환경을 지도에서 살펴보고 후보 주소를 저장·메모·비교하는 웹앱.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body><AppProvider><MemoPanelProvider><FacilitiesProvider><TransitProvider><NoiseProvider><SafetyProvider><a href="#content" className="skip-link">본문으로 이동</a><Header/><DemoBanner/><main id="content">{children}</main><Footer/></SafetyProvider></NoiseProvider></TransitProvider></FacilitiesProvider></MemoPanelProvider></AppProvider></body></html>;}
