import {
  Box,
  Flex,
  Text,
  VStack,
  Icon,
  useColorModeValue,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerBody,
} from "@chakra-ui/react";
import { NavLink, useLocation } from "react-router-dom";
import {
  MdDashboard,
  MdBookmarks,
  MdFileUpload,
  MdShare,
  MdLabel,
  MdFolder,
} from "react-icons/md";

const links = [
  { name: "Dashboard", path: "/", icon: MdDashboard },
  { name: "Bookmarks", path: "/bookmarks", icon: MdBookmarks },
  { name: "Collections", path: "/collections", icon: MdFolder },
  { name: "Import", path: "/import", icon: MdFileUpload },
  { name: "Export to Claude", path: "/export", icon: MdShare },
  { name: "Tags", path: "/tags", icon: MdLabel },
];

function SidebarContent() {
  const location = useLocation();
  const bgActive = useColorModeValue("white", "navy.700");
  const textColor = useColorModeValue("secondaryGray.900", "white");
  const textInactive = useColorModeValue("secondaryGray.600", "secondaryGray.600");
  const brandColor = useColorModeValue("brand.500", "brand.400");

  return (
    <Flex direction="column" h="100%" pt="25px" px="16px" borderRadius="30px">
      <Flex align="center" mb="30px" px="16px">
        <Text
          fontSize="xl"
          fontWeight="800"
          color={brandColor}
          letterSpacing="-0.5px"
        >
          X Bookmarks
        </Text>
      </Flex>

      <VStack spacing="4px" align="stretch">
        {links.map((link) => {
          const isActive = location.pathname === link.path;
          return (
            <NavLink key={link.path} to={link.path}>
              <Flex
                align="center"
                p="10px 16px"
                borderRadius="16px"
                bg={isActive ? bgActive : "transparent"}
                boxShadow={
                  isActive
                    ? "0px 3.5px 5.5px rgba(0, 0, 0, 0.02)"
                    : "none"
                }
                _hover={{ bg: isActive ? bgActive : "whiteAlpha.100" }}
                transition="all 0.2s"
              >
                <Icon
                  as={link.icon}
                  w="20px"
                  h="20px"
                  color={isActive ? brandColor : textInactive}
                  mr="12px"
                />
                <Text
                  fontSize="sm"
                  fontWeight={isActive ? "700" : "500"}
                  color={isActive ? textColor : textInactive}
                >
                  {link.name}
                </Text>
              </Flex>
            </NavLink>
          );
        })}
      </VStack>
    </Flex>
  );
}

export default function Sidebar({ isOpen, onClose }) {
  const sidebarBg = useColorModeValue("white", "navy.800");

  return (
    <>
      {/* Desktop sidebar */}
      <Box
        display={{ base: "none", xl: "block" }}
        position="fixed"
        w="280px"
        h="100vh"
        bg={sidebarBg}
        borderRight="1px solid"
        borderColor={useColorModeValue("gray.200", "whiteAlpha.100")}
      >
        <SidebarContent />
      </Box>

      {/* Mobile drawer */}
      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent bg={sidebarBg} maxW="280px">
          <DrawerCloseButton color="white" />
          <DrawerBody p="0">
            <SidebarContent />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
