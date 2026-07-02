import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Editor from './pages/Editor'
import AnalysePage from './pages/AnalysePage'
import ChallengePage from './pages/ChallengePage'
import MockSummaryPage from './pages/MockSummaryPage'
import SessionReportPage from './pages/SessionReportPage'
import AnalysisReportsPage from './pages/AnalysisReportsPage'
import SessionCardPage from './pages/SessionCardPage'
import NewRoomRedirect from './pages/NewRoomRedirect'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from '../Context/ThemeContext'
import CustomCursor from './components/CustomCursor'
import ScrollProgress from './components/ScrollProgress'

function AppChrome() {
  const location = useLocation()
  const showProgress = (
    location.pathname.startsWith('/editor/') ||
    location.pathname.startsWith('/room/') ||
    location.pathname.startsWith('/report/') ||
    location.pathname.startsWith('/history/') ||
    location.pathname.startsWith('/analysis/') ||
    location.pathname === '/analyse'
  )

  return (
    <>
      <CustomCursor />
      {showProgress ? <ScrollProgress /> : null}
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/analyse" element={<AnalysePage />} />
        <Route path="/daily-challenge" element={<AnalysePage isDaily={true} />} />
        <Route path="/analysis/:analysisId" element={<AnalysePage />} />
        <Route path="/summary/:summaryId" element={<MockSummaryPage />} />
        <Route path="/challenge/:id" element={<ChallengePage />} />
        <Route path="/report/:shareId" element={<SessionReportPage />} />
        <Route path="/card/:shareId" element={<SessionCardPage />} />
        <Route path="/history/reports" element={<AnalysisReportsPage />} />
        <Route path="/new" element={<NewRoomRedirect />} />
        <Route path="/editor/:roomId" element={<Editor />} />
        <Route path="/room/:roomId" element={<Editor />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}


function App() {

  return (
    <>
      <ThemeProvider>
        <BrowserRouter>
          <AppChrome />
        </BrowserRouter>
        <Toaster position='top:right' />
      </ThemeProvider>
    </>

  )
}

export default App
