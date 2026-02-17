import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import {
  Dashboard,
  App,
  SystemPrompts,
  ViewChat,
  Settings,
  DevSpace,
  Shortcuts,
  Audio,
  Screenshot,
  Chats,
  Responses,
  Knowledge,
  KnowledgeChatPage,
  PagesListPage,
  PageEditorPage,
  ProjectsListPage,
  ProjectViewPage,
  Meetings,
  MeetingView,
} from "@/pages";
import { DashboardLayout } from "@/layouts";

export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chats" element={<Chats />} />
          <Route path="/system-prompts" element={<SystemPrompts />} />
          <Route path="/chats/view/:conversationId" element={<ViewChat />} />
          <Route path="/shortcuts" element={<Shortcuts />} />
          <Route path="/screenshot" element={<Screenshot />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/audio" element={<Audio />} />
          <Route path="/responses" element={<Responses />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/knowledge/chat" element={<KnowledgeChatPage />} />
          <Route path="/knowledge/pages" element={<PagesListPage />} />
          <Route path="/knowledge/pages/:id" element={<PageEditorPage />} />
          <Route path="/knowledge/projects" element={<ProjectsListPage />} />
          <Route path="/knowledge/projects/:id" element={<ProjectViewPage />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/meetings/:id" element={<MeetingView />} />
          <Route path="/dev-space" element={<DevSpace />} />
        </Route>
      </Routes>
    </Router>
  );
}
