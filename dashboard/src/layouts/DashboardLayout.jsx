import { Box, useDisclosure } from "@chakra-ui/react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/sidebar/Sidebar";
import useKeyboardShortcuts from "../lib/useKeyboardShortcuts";

export default function DashboardLayout() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  useKeyboardShortcuts();

  return (
    <Box minH="100vh">
      <Sidebar isOpen={isOpen} onClose={onClose} />
      <Box
        ml={{ base: 0, xl: "280px" }}
        p={{ base: "16px", md: "20px 30px" }}
        minH="100vh"
      >
        <Outlet context={{ onOpenSidebar: onOpen }} />
      </Box>
    </Box>
  );
}
