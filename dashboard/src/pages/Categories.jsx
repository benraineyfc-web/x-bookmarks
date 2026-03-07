import { useEffect, useState } from "react";
import {
  Box,
  SimpleGrid,
  Text,
  Flex,
  useColorModeValue,
  Badge,
  Button,
  useToast,
  Progress,
} from "@chakra-ui/react";
import { MdRefresh } from "react-icons/md";
import { useOutletContext, useNavigate } from "react-router-dom";
import Navbar from "../components/navbar/Navbar";
import Card from "../components/card/Card";
import BookmarkCard from "../components/bookmarks/BookmarkCard";
import { db, recategorizeAll } from "../lib/db";
import { CATEGORIES, getCategoryColor } from "../lib/categorize";

export default function Categories() {
  const { onOpenSidebar } = useOutletContext();
  const navigate = useNavigate();
  const toast = useToast();
  const [bookmarks, setBookmarks] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [categoryCounts, setCategoryCounts] = useState({});
  const [uncategorized, setUncategorized] = useState(0);
  const [recategorizing, setRecategorizing] = useState(false);

  const textColor = useColorModeValue("secondaryGray.900", "white");
  const subColor = useColorModeValue("secondaryGray.600", "secondaryGray.600");
  const brandColor = useColorModeValue("brand.500", "brand.400");

  const loadData = async () => {
    const all = await db.bookmarks.toArray();
    setBookmarks(all);

    const counts = {};
    let uncat = 0;
    for (const bm of all) {
      if (!bm.categories || bm.categories.length === 0) {
        uncat++;
      } else {
        for (const cat of bm.categories) {
          counts[cat] = (counts[cat] || 0) + 1;
        }
      }
    }
    setCategoryCounts(counts);
    setUncategorized(uncat);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecategorize = async () => {
    setRecategorizing(true);
    try {
      const count = await recategorizeAll();
      toast({
        title: `Recategorized ${count} bookmarks`,
        status: "success",
        duration: 3000,
        position: "top",
      });
      await loadData();
    } catch (e) {
      toast({
        title: "Error recategorizing",
        description: e.message,
        status: "error",
        duration: 3000,
        position: "top",
      });
    }
    setRecategorizing(false);
  };

  const handleDelete = (id) => {
    setBookmarks((prev) => prev.filter((bm) => bm.id !== id));
  };

  const handleFavoriteToggle = (id, val) => {
    setBookmarks((prev) =>
      prev.map((bm) => (bm.id === id ? { ...bm, favorite: val } : bm))
    );
  };

  const filteredBookmarks = activeCategory
    ? activeCategory === "__uncategorized"
      ? bookmarks.filter((bm) => !bm.categories || bm.categories.length === 0)
      : bookmarks.filter((bm) => bm.categories && bm.categories.includes(activeCategory))
    : [];

  const sortedCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1]);

  return (
    <Box>
      <Navbar onOpen={onOpenSidebar} title="Categories" />

      {/* Recategorize action */}
      <Card mb="20px" p="16px 20px">
        <Flex align="center" justify="space-between" wrap="wrap" gap="12px">
          <Box>
            <Text fontSize="sm" fontWeight="700" color={textColor}>
              Auto-Categorization
            </Text>
            <Text fontSize="xs" color={subColor}>
              Analyzes tweet text and scraped content to assign categories automatically
            </Text>
          </Box>
          <Button
            size="sm"
            leftIcon={<MdRefresh />}
            colorScheme="brand"
            variant="solid"
            borderRadius="12px"
            isLoading={recategorizing}
            loadingText="Categorizing..."
            onClick={handleRecategorize}
          >
            Recategorize All
          </Button>
        </Flex>
        {recategorizing && <Progress size="xs" isIndeterminate mt="12px" borderRadius="full" colorScheme="brand" />}
      </Card>

      {/* Category grid */}
      <Text fontSize="sm" fontWeight="700" color={textColor} mb="12px">
        {sortedCategories.length} Categories Found
      </Text>
      <SimpleGrid columns={{ base: 2, md: 3, xl: 5 }} gap="12px" mb="20px">
        {sortedCategories.map(([cat, count]) => (
          <Card
            key={cat}
            cursor="pointer"
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            border="2px solid"
            borderColor={activeCategory === cat ? brandColor : "transparent"}
            p="16px"
            _hover={{ transform: "translateY(-2px)" }}
            transition="all 0.15s"
          >
            <Badge colorScheme={getCategoryColor(cat)} fontSize="xs" borderRadius="full" mb="8px">
              {cat}
            </Badge>
            <Text fontSize="2xl" fontWeight="800" color={textColor}>
              {count}
            </Text>
            <Text fontSize="xs" color={subColor}>
              bookmark{count !== 1 ? "s" : ""}
            </Text>
          </Card>
        ))}

        {uncategorized > 0 && (
          <Card
            cursor="pointer"
            onClick={() => setActiveCategory(activeCategory === "__uncategorized" ? null : "__uncategorized")}
            border="2px solid"
            borderColor={activeCategory === "__uncategorized" ? brandColor : "transparent"}
            p="16px"
            _hover={{ transform: "translateY(-2px)" }}
            transition="all 0.15s"
          >
            <Badge colorScheme="gray" fontSize="xs" borderRadius="full" mb="8px">
              Uncategorized
            </Badge>
            <Text fontSize="2xl" fontWeight="800" color={textColor}>
              {uncategorized}
            </Text>
            <Text fontSize="xs" color={subColor}>
              bookmark{uncategorized !== 1 ? "s" : ""}
            </Text>
          </Card>
        )}
      </SimpleGrid>

      {/* Filtered bookmarks */}
      {activeCategory && (
        <>
          <Flex justify="space-between" align="center" mb="12px">
            <Text fontSize="sm" fontWeight="700" color={textColor}>
              {activeCategory === "__uncategorized" ? "Uncategorized" : activeCategory}{" "}
              ({filteredBookmarks.length})
            </Text>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setActiveCategory(null)}
              color={subColor}
            >
              Clear Filter
            </Button>
          </Flex>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="16px">
            {filteredBookmarks.map((bm) => (
              <BookmarkCard
                key={bm.id}
                bookmark={bm}
                onDelete={handleDelete}
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </SimpleGrid>
        </>
      )}

      {!activeCategory && bookmarks.length > 0 && (
        <Card>
          <Text color={subColor} textAlign="center" py="30px" fontSize="sm">
            Click a category above to view its bookmarks
          </Text>
        </Card>
      )}

      {bookmarks.length === 0 && (
        <Card>
          <Text color={subColor} textAlign="center" py="40px">
            No bookmarks yet. Import some first!
          </Text>
        </Card>
      )}
    </Box>
  );
}
