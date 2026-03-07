import { useEffect, useState } from "react";
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
  Badge,
} from "@chakra-ui/react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  MdDashboard,
  MdBookmarks,
  MdFileUpload,
  MdDescription,
  MdLabel,
  MdFolder,
  MdCategory,
  MdStar,
  MdInbox,
  MdFilterList,
  MdLink,
  MdVideocam,
  MdImage,
} from "react-icons/md";
import { db } from "../../lib/db";
import { getCategoryColor } from "../../lib/categorize";

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
        overflowY="auto"
        css={{
          "&::-webkit-scrollbar": { width: "4px" },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": { background: "#CBD5E0", borderRadius: "4px" },
        }}
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

function SidebarContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const bgActive = useColorModeValue("gray.50", "navy.700");
  const textColor = useColorModeValue("secondaryGray.900", "white");
  const textInactive = useColorModeValue("secondaryGray.600", "secondaryGray.600");
  const brandColor = useColorModeValue("brand.500", "brand.400");
  const countColor = useColorModeValue("secondaryGray.500", "secondaryGray.600");
  const dividerColor = useColorModeValue("gray.100", "whiteAlpha.100");

  const [stats, setStats] = useState({
    total: 0,
    unsorted: 0,
    favorites: 0,
    categories: [],
    collections: [],
    tags: [],
  });

  useEffect(() => {
    async function loadSidebarData() {
      const all = await db.bookmarks.toArray();
      const collections = await db.collections.toArray();

      let unsorted = 0;
      let favCount = 0;
      const catCounts = {};
      const tagCounts = {};

      for (const bm of all) {
        if (!bm.categories || bm.categories.length === 0) unsorted++;
        if (bm.favorite) favCount++;
        if (bm.categories) {
          for (const c of bm.categories) {
            catCounts[c] = (catCounts[c] || 0) + 1;
          }
        }
        if (bm.tags) {
          for (const t of bm.tags) {
            tagCounts[t] = (tagCounts[t] || 0) + 1;
          }
        }
      }

      // Get collection counts
      const collectionItems = await db.collectionItems.toArray();
      const collCounts = {};
      for (const item of collectionItems) {
        collCounts[item.collectionId] = (collCounts[item.collectionId] || 0) + 1;
      }

      setStats({
        total: all.length,
        unsorted,
        favorites: favCount,
        categories: Object.entries(catCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count })),
        collections: collections.map((c) => ({
          ...c,
          count: collCounts[c.id] || 0,
        })),
        tags: Object.entries(tagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([name, count]) => ({ name, count })),
      });
    }

    loadSidebarData();
    // Refresh when navigating
    const interval = setInterval(loadSidebarData, 3000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (path) => {
    if (path.includes("?")) {
      return location.pathname + location.search === path;
    }
    return location.pathname === path;
  };

  const SidebarLink = ({ path, icon, label, count, onClick }) => {
    const active = isActive(path);
    const content = (
      <Flex
        align="center"
        p="8px 12px"
        borderRadius="12px"
        bg={active ? bgActive : "transparent"}
        _hover={{ bg: active ? bgActive : useColorModeValue("gray.50", "whiteAlpha.50") }}
        transition="all 0.15s"
        cursor="pointer"
        justify="space-between"
      >
        <Flex align="center" gap="10px">
          <Icon as={icon} w="18px" h="18px" color={active ? brandColor : textInactive} />
          <Text fontSize="sm" fontWeight={active ? "600" : "400"} color={active ? textColor : textInactive}>
            {label}
          </Text>
        </Flex>
        {count !== undefined && count > 0 && (
          <Text fontSize="xs" fontWeight="600" color={countColor}>
            {count}
          </Text>
        )}
      </Flex>
    );

    if (onClick) {
      return <Box onClick={onClick}>{content}</Box>;
    }
    return <NavLink to={path}>{content}</NavLink>;
  };

  return (
    <Flex direction="column" h="100%" pt="20px" px="12px" pb="20px">
      {/* Logo */}
      <Flex align="center" mb="24px" px="12px">
        <Text fontSize="xl" fontWeight="800" color={textColor} letterSpacing="-0.5px">
          X Bookmarks
        </Text>
      </Flex>

      {/* Main nav */}
      <VStack spacing="2px" align="stretch" mb="16px">
        <SidebarLink path="/bookmarks" icon={MdBookmarks} label="All Bookmarks" count={stats.total} />
        <SidebarLink
          path="/bookmarks?category=unsorted"
          icon={MdInbox}
          label="Unsorted"
          count={stats.unsorted}
          onClick={() => navigate("/bookmarks?category=unsorted")}
        />
        <SidebarLink path="/" icon={MdDashboard} label="Dashboard" />
        <SidebarLink
          path="/bookmarks?favorites=true"
          icon={MdStar}
          label="Favorites"
          count={stats.favorites}
        />
      </VStack>

      <Divider borderColor={dividerColor} mb="12px" />

      {/* Categories */}
      <Text fontSize="xs" fontWeight="700" color={textInactive} px="12px" mb="6px" textTransform="uppercase" letterSpacing="1px">
        Categories
      </Text>
      <VStack spacing="1px" align="stretch" mb="16px">
        {stats.categories.length === 0 ? (
          <Text fontSize="xs" color={textInactive} px="12px" py="4px">
            Import & auto-categorize
          </Text>
        ) : (
          stats.categories.map((cat) => (
            <Flex
              key={cat.name}
              align="center"
              justify="space-between"
              p="6px 12px"
              borderRadius="10px"
              cursor="pointer"
              _hover={{ bg: useColorModeValue("gray.50", "whiteAlpha.50") }}
              onClick={() => navigate(`/bookmarks?category=${encodeURIComponent(cat.name)}`)}
            >
              <Flex align="center" gap="8px">
                <Box w="8px" h="8px" borderRadius="full" bg={`${getCategoryColor(cat.name)}.400`} />
                <Text fontSize="sm" color={textInactive} fontWeight="400">
                  {cat.name}
                </Text>
              </Flex>
              <Text fontSize="xs" color={countColor} fontWeight="500">
                {cat.count}
              </Text>
            </Flex>
          ))
        )}
        <Box px="12px" pt="2px">
          <NavLink to="/categories">
            <Text fontSize="xs" color={brandColor} fontWeight="500" cursor="pointer" _hover={{ textDecoration: "underline" }}>
              Manage Categories
            </Text>
          </NavLink>
        </Box>
      </VStack>

      <Divider borderColor={dividerColor} mb="12px" />

      {/* Collections (Folders) */}
      <Text fontSize="xs" fontWeight="700" color={textInactive} px="12px" mb="6px" textTransform="uppercase" letterSpacing="1px">
        Folders
      </Text>
      <VStack spacing="1px" align="stretch" mb="16px">
        {stats.collections.length === 0 ? (
          <Text fontSize="xs" color={textInactive} px="12px" py="4px">
            No folders yet
          </Text>
        ) : (
          stats.collections.map((coll) => (
            <Flex
              key={coll.id}
              align="center"
              justify="space-between"
              p="6px 12px"
              borderRadius="10px"
              cursor="pointer"
              _hover={{ bg: useColorModeValue("gray.50", "whiteAlpha.50") }}
              onClick={() => navigate("/collections")}
            >
              <Flex align="center" gap="8px">
                <Icon as={MdFolder} w="16px" h="16px" color={textInactive} />
                <Text fontSize="sm" color={textInactive} fontWeight="400">
                  {coll.name}
                </Text>
              </Flex>
              <Text fontSize="xs" color={countColor} fontWeight="500">
                {coll.count}
              </Text>
            </Flex>
          ))
        )}
        <Box px="12px" pt="2px">
          <NavLink to="/collections">
            <Text fontSize="xs" color={brandColor} fontWeight="500" cursor="pointer" _hover={{ textDecoration: "underline" }}>
              Manage Folders
            </Text>
          </NavLink>
        </Box>
      </VStack>

      <Divider borderColor={dividerColor} mb="12px" />

      {/* Tags */}
      {stats.tags.length > 0 && (
        <>
          <Text fontSize="xs" fontWeight="700" color={textInactive} px="12px" mb="6px" textTransform="uppercase" letterSpacing="1px">
            Tags
          </Text>
          <VStack spacing="1px" align="stretch" mb="16px">
            {stats.tags.map((tag) => (
              <Flex
                key={tag.name}
                align="center"
                justify="space-between"
                p="6px 12px"
                borderRadius="10px"
                cursor="pointer"
                _hover={{ bg: useColorModeValue("gray.50", "whiteAlpha.50") }}
                onClick={() => navigate(`/bookmarks?tag=${encodeURIComponent(tag.name)}`)}
              >
                <Flex align="center" gap="8px">
                  <Text fontSize="sm" color={textInactive}>#</Text>
                  <Text fontSize="sm" color={textInactive} fontWeight="400">
                    {tag.name}
                  </Text>
                </Flex>
                <Text fontSize="xs" color={countColor} fontWeight="500">
                  {tag.count}
                </Text>
              </Flex>
            ))}
            <Box px="12px" pt="2px">
              <NavLink to="/tags">
                <Text fontSize="xs" color={brandColor} fontWeight="500" cursor="pointer" _hover={{ textDecoration: "underline" }}>
                  All Tags
                </Text>
              </NavLink>
            </Box>
          </VStack>

          <Divider borderColor={dividerColor} mb="12px" />
        </>
      )}

      {/* Tools */}
      <Text fontSize="xs" fontWeight="700" color={textInactive} px="12px" mb="6px" textTransform="uppercase" letterSpacing="1px">
        Tools
      </Text>
      <VStack spacing="2px" align="stretch">
        <SidebarLink path="/import" icon={MdFileUpload} label="Import" />
        <SidebarLink path="/export" icon={MdDescription} label="Generate Docs" />
        <SidebarLink path="/tags" icon={MdLabel} label="Manage Tags" />
      </VStack>
    </Flex>
  );
}
