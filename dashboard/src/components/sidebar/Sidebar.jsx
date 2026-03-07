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
  Divider,
} from "@chakra-ui/react";
import { NavLink, useLocation } from "react-router-dom";
import {
  MdDashboard,
  MdBookmarks,
  MdFileUpload,
  MdDescription,
  MdLabel,
  MdFolder,
  MdCategory,
  MdStar,
} from "react-icons/md";

const mainLinks = [
  { name: "Dashboard", path: "/", icon: MdDashboard },
  { name: "Bookmarks", path: "/bookmarks", icon: MdBookmarks },
  { name: "Categories", path: "/categories", icon: MdCategory },
  { name: "Collections", path: "/collections", icon: MdFolder },
  { name: "Favorites", path: "/bookmarks?favorites=true", icon: MdStar },
];

const toolLinks = [
  { name: "Import", path: "/import", icon: MdFileUpload },
  { name: "Generate Docs", path: "/export", icon: MdDescription },
  { name: "Tags", path: "/tags", icon: MdLabel },
];

function SidebarContent() {
  const location = useLocation();
  const bgActive = useColorModeValue("white", "navy.700");
  const textColor = useColorModeValue("secondaryGray.900", "white");
  const textInactive = useColorModeValue("secondaryGray.600", "secondaryGray.600");
  const brandColor = useColorModeValue("brand.500", "brand.400");
  const dividerColor = useColorModeValue("gray.200", "whiteAlpha.100");

  const isActive = (path) => {
    if (path.includes("?")) {
      return location.pathname + location.search === path;
    }
    return location.pathname === path;
  };

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

      <Text fontSize="xs" fontWeight="700" color={textInactive} px="16px" mb="8px" textTransform="uppercase" letterSpacing="1px">
        Navigate
      </Text>
      <VStack spacing="4px" align="stretch" mb="20px">
        {mainLinks.map((link) => {
          const active = isActive(link.path);
          return (
            <NavLink key={link.path} to={link.path}>
              <Flex
                align="center"
                p="10px 16px"
                borderRadius="16px"
                bg={active ? bgActive : "transparent"}
                boxShadow={active ? "0px 3.5px 5.5px rgba(0, 0, 0, 0.02)" : "none"}
                _hover={{ bg: active ? bgActive : useColorModeValue("gray.50", "whiteAlpha.100") }}
                transition="all 0.2s"
              >
                <Icon as={link.icon} w="20px" h="20px" color={active ? brandColor : textInactive} mr="12px" />
                <Text fontSize="sm" fontWeight={active ? "700" : "500"} color={active ? textColor : textInactive}>
                  {link.name}
                </Text>
              </Flex>
            </NavLink>
          );
        })}
      </VStack>

      <Divider borderColor={dividerColor} mb="16px" />

      <Text fontSize="xs" fontWeight="700" color={textInactive} px="16px" mb="8px" textTransform="uppercase" letterSpacing="1px">
        Tools
      </Text>
      <VStack spacing="4px" align="stretch">
        {toolLinks.map((link) => {
          const active = isActive(link.path);
          return (
            <NavLink key={link.path} to={link.path}>
              <Flex
                align="center"
                p="10px 16px"
                borderRadius="16px"
                bg={active ? bgActive : "transparent"}
                boxShadow={active ? "0px 3.5px 5.5px rgba(0, 0, 0, 0.02)" : "none"}
                _hover={{ bg: active ? bgActive : useColorModeValue("gray.50", "whiteAlpha.100") }}
                transition="all 0.2s"
              >
                <Icon as={link.icon} w="20px" h="20px" color={active ? brandColor : textInactive} mr="12px" />
                <Text fontSize="sm" fontWeight={active ? "700" : "500"} color={active ? textColor : textInactive}>
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
          <DrawerCloseButton color={useColorModeValue("gray.600", "white")} />
          <DrawerBody p="0">
            <SidebarContent />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
