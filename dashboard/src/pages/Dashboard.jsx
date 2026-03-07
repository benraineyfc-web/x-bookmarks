import { useEffect, useState } from "react";
import {
  SimpleGrid,
  Box,
  Text,
  Flex,
  useColorModeValue,
  VStack,
  Button,
  Progress,
  useToast,
  Badge,
  HStack,
  Icon,
} from "@chakra-ui/react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  MdBookmarks,
  MdPerson,
  MdFavorite,
  MdTrendingUp,
  MdCloudDownload,
  MdStar,
  MdCheckCircle,
  MdArrowForward,
  MdCategory,
  MdDescription,
  MdFileUpload,
  MdAutoAwesome,
} from "react-icons/md";
import Navbar from "../components/navbar/Navbar";
import MiniStat from "../components/stats/MiniStat";
import BookmarkCard from "../components/bookmarks/BookmarkCard";
import Card from "../components/card/Card";
import TrendChart from "../components/stats/TrendChart";
import { db, recategorizeAll } from "../lib/db";
import { getCategoryColor } from "../lib/categorize";
import { scrapeBookmarkBatch } from "../lib/scraper";

export default function Dashboard() {
  const { onOpenSidebar } = useOutletContext();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    authors: 0,
    totalLikes: 0,
    thisWeek: 0,
    favorites: 0,
    categorized: 0,
  });
  const [recent, setRecent] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [topAuthors, setTopAuthors] = useState([]);
  const [weeklyTrend, setWeeklyTrend] = useState([]);
  const [engagementData, setEngagementData] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [topActions, setTopActions] = useState([]);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState(null);
  const toast = useToast();
  const textColor = useColorModeValue("gray.800", "white");
  const subColor = useColorModeValue("gray.500", "gray.400");
  const brandColor = useColorModeValue("brand.500", "brand.400");
  const cardBorder = useColorModeValue("gray.100", "whiteAlpha.100");

  const loadStats = async () => {
    const all = await db.bookmarks.toArray();
    const authors = new Map();
    let totalLikes = 0;
    let favCount = 0;
    let categorizedCount = 0;
    const catCounts = {};
    const allActions = [];

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    let thisWeek = 0;

    for (const bm of all) {
      totalLikes += bm.likes || 0;
      const a = bm.author_username;
      if (a) {
        authors.set(a, (authors.get(a) || 0) + 1);
      }
      if (bm.importedAt && new Date(bm.importedAt) > oneWeekAgo) {
        thisWeek++;
      }
      if (bm.favorite) favCount++;
      if (bm.categories && bm.categories.length > 0) {
        categorizedCount++;
        for (const cat of bm.categories) {
          catCounts[cat] = (catCounts[cat] || 0) + 1;
        }
      }
      if (bm.actionItems && bm.actionItems.length > 0) {
        allActions.push(...bm.actionItems.slice(0, 2).map((item) => ({
          text: item,
          author: bm.author_username,
          bookmarkId: bm.id,
        })));
      }
    }

    setStats({
      total: all.length,
      authors: authors.size,
      totalLikes,
      thisWeek,
      favorites: favCount,
      categorized: categorizedCount,
    });

    const sorted = [...all].sort(
      (a, b) => new Date(b.importedAt || 0) - new Date(a.importedAt || 0)
    );
    setRecent(sorted.slice(0, 6));

    const favs = all.filter((bm) => bm.favorite)
      .sort((a, b) => new Date(b.importedAt || 0) - new Date(a.importedAt || 0))
      .slice(0, 4);
    setFavorites(favs);

    const authorList = [...authors.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    setTopAuthors(authorList);

    const catList = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
    setCategoryBreakdown(catList);

    setTopActions(allActions.slice(0, 8));

    const weeks = [];
    for (let w = 7; w >= 0; w--) {
      const start = new Date();
      start.setDate(start.getDate() - w * 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const count = all.filter((bm) => {
        const d = new Date(bm.importedAt || bm.created_at || 0);
        return d >= start && d < end;
      }).length;
      const label = start.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      weeks.push({ label, value: count });
    }
    setWeeklyTrend(weeks);

    const authorEngagement = [...authors.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => {
        const authorBms = all.filter((bm) => bm.author_username === name);
        const avgLikes = Math.round(
          authorBms.reduce((s, bm) => s + (bm.likes || 0), 0) / authorBms.length
        );
        return { label: `@${name.slice(0, 8)}`, value: avgLikes };
      });
    setEngagementData(authorEngagement);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleScrapeAll = async () => {
    setScraping(true);
    setScrapeResult(null);
    try {
      const data = await scrapeBookmarkBatch(10);
      setScrapeResult(data);
      toast({
        title: `Scraped ${data.scraped || 0} bookmarks`,
        description: `${data.failed || 0} failed, ${data.remaining || 0} remaining`,
        status: data.scraped > 0 ? "success" : "info",
        duration: 4000,
        isClosable: true,
        position: "top",
      });
      loadStats();
    } catch (e) {
      toast({
        title: "Scrape failed",
        description: e.message,
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "top",
      });
    }
    setScraping(false);
  };

  const handleDelete = (id) => {
    setRecent((prev) => prev.filter((bm) => bm.id !== id));
    setFavorites((prev) => prev.filter((bm) => bm.id !== id));
    loadStats();
  };

  const handleFavoriteToggle = (id, val) => {
    setRecent((prev) =>
      prev.map((bm) => (bm.id === id ? { ...bm, favorite: val } : bm))
    );
    loadStats();
  };

  return (
    <Box>
      <Navbar onOpen={onOpenSidebar} title="Dashboard" />

      {/* Stats row */}
      <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} gap="16px" mb="24px">
        <MiniStat
          name="Total Bookmarks"
          value={stats.total.toLocaleString()}
          icon={MdBookmarks}
          iconBg="linear-gradient(135deg, #63B3ED 0%, #2B6CB0 100%)"
        />
        <MiniStat
          name="Unique Authors"
          value={stats.authors.toLocaleString()}
          icon={MdPerson}
          iconBg="linear-gradient(135deg, #68D391 0%, #38A169 100%)"
        />
        <MiniStat
          name="Total Likes"
          value={
            stats.totalLikes >= 1000000
              ? (stats.totalLikes / 1000000).toFixed(1) + "M"
              : stats.totalLikes >= 1000
              ? (stats.totalLikes / 1000).toFixed(1) + "K"
              : stats.totalLikes.toLocaleString()
          }
          icon={MdFavorite}
          iconBg="linear-gradient(135deg, #FC8181 0%, #E53E3E 100%)"
        />
        <MiniStat
          name="Added This Week"
          value={stats.thisWeek.toLocaleString()}
          icon={MdTrendingUp}
          iconBg="linear-gradient(135deg, #F6AD55 0%, #DD6B20 100%)"
        />
        <MiniStat
          name="Favorites"
          value={stats.favorites.toLocaleString()}
          icon={MdStar}
          iconBg="linear-gradient(135deg, #FBD38D 0%, #D69E2E 100%)"
        />
        <MiniStat
          name="Categorized"
          value={stats.categorized.toLocaleString()}
          icon={MdCategory}
          iconBg="linear-gradient(135deg, #B794F4 0%, #805AD5 100%)"
        />
      </SimpleGrid>

      {/* Quick Actions row */}
      <SimpleGrid columns={{ base: 2, md: 4 }} gap="12px" mb="24px">
        <Button
          size="sm"
          variant="outline"
          borderRadius="12px"
          leftIcon={<MdFileUpload />}
          onClick={() => navigate("/import")}
          fontWeight="500"
          h="42px"
          justifyContent="flex-start"
          px="14px"
        >
          Import Bookmarks
        </Button>
        <Button
          size="sm"
          variant="outline"
          borderRadius="12px"
          leftIcon={<MdDescription />}
          onClick={() => navigate("/export")}
          fontWeight="500"
          h="42px"
          justifyContent="flex-start"
          px="14px"
        >
          Generate Docs
        </Button>
        <Button
          size="sm"
          variant="outline"
          borderRadius="12px"
          leftIcon={<MdAutoAwesome />}
          onClick={() => navigate("/categories")}
          fontWeight="500"
          h="42px"
          justifyContent="flex-start"
          px="14px"
        >
          Auto-Categorize
        </Button>
        <Button
          size="sm"
          colorScheme="brand"
          variant="outline"
          borderRadius="12px"
          leftIcon={<MdCloudDownload />}
          isLoading={scraping}
          loadingText="Scraping..."
          onClick={handleScrapeAll}
          fontWeight="500"
          h="42px"
          justifyContent="flex-start"
          px="14px"
        >
          Batch Scrape
        </Button>
      </SimpleGrid>

      {scraping && <Progress size="xs" isIndeterminate borderRadius="full" colorScheme="brand" mb="16px" />}
      {scrapeResult && (
        <Text fontSize="xs" color="green.500" mb="16px" px="4px">
          {scrapeResult.scraped || 0} scraped, {scrapeResult.errors || 0} errors
        </Text>
      )}

      {/* Charts + Categories */}
      <SimpleGrid columns={{ base: 1, xl: 3 }} gap="20px" mb="24px">
        <Card>
          <TrendChart data={weeklyTrend} title="Bookmarks Added (Last 8 Weeks)" color="#2B6CB0" />
        </Card>
        <Card>
          <TrendChart data={engagementData} title="Avg Likes by Top Authors" color="#38A169" />
        </Card>
        <Card>
          <Flex justify="space-between" align="center" mb="12px">
            <Text fontSize="sm" fontWeight="700" color={textColor}>
              Categories
            </Text>
            <Button
              size="xs"
              variant="ghost"
              color={brandColor}
              rightIcon={<MdArrowForward />}
              onClick={() => navigate("/categories")}
            >
              View All
            </Button>
          </Flex>
          {categoryBreakdown.length === 0 ? (
            <Text color={subColor} fontSize="sm" textAlign="center" py="16px">
              No categories yet
            </Text>
          ) : (
            <VStack spacing="8px" align="stretch">
              {categoryBreakdown.map((cat) => (
                <Flex
                  key={cat.name}
                  justify="space-between"
                  align="center"
                  cursor="pointer"
                  _hover={{ opacity: 0.8 }}
                  onClick={() => navigate(`/bookmarks?category=${encodeURIComponent(cat.name)}`)}
                >
                  <HStack>
                    <Box w="8px" h="8px" borderRadius="full" bg={`${getCategoryColor(cat.name)}.400`} />
                    <Text fontSize="sm" color={textColor}>{cat.name}</Text>
                  </HStack>
                  <Text fontSize="sm" fontWeight="600" color={brandColor}>
                    {cat.count}
                  </Text>
                </Flex>
              ))}
            </VStack>
          )}
        </Card>
      </SimpleGrid>

      {/* Actionable Steps */}
      {topActions.length > 0 && (
        <Card mb="24px">
          <Text fontSize="sm" fontWeight="700" color={textColor} mb="10px">
            Actionable Steps (from your bookmarks)
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="6px">
            {topActions.map((action, i) => (
              <Flex key={i} align="flex-start" gap="8px" p="8px" borderRadius="8px" bg={useColorModeValue("green.50", "green.900")}>
                <MdCheckCircle color="#38A169" style={{ marginTop: 2, flexShrink: 0 }} />
                <Box>
                  <Text fontSize="xs" color={textColor} lineHeight="1.4">
                    {action.text}
                  </Text>
                  <Text fontSize="10px" color={subColor}>
                    from @{action.author}
                  </Text>
                </Box>
              </Flex>
            ))}
          </SimpleGrid>
        </Card>
      )}

      {/* Favorites + Recent + Top Authors */}
      <SimpleGrid columns={{ base: 1, xl: 3 }} gap="20px">
        <Box gridColumn={{ xl: "span 2" }}>
          {/* Favorites section */}
          {favorites.length > 0 && (
            <Box mb="24px">
              <Flex justify="space-between" align="center" mb="10px">
                <Text fontSize="sm" fontWeight="700" color={textColor}>
                  Favorites
                </Text>
                <Button
                  size="xs"
                  variant="ghost"
                  color={brandColor}
                  onClick={() => navigate("/bookmarks?favorites=true")}
                  rightIcon={<MdArrowForward />}
                >
                  View All
                </Button>
              </Flex>
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="14px">
                {favorites.map((bm) => (
                  <BookmarkCard
                    key={bm.id}
                    bookmark={bm}
                    onDelete={handleDelete}
                    onFavoriteToggle={handleFavoriteToggle}
                  />
                ))}
              </SimpleGrid>
            </Box>
          )}

          <Flex justify="space-between" align="center" mb="10px">
            <Text fontSize="sm" fontWeight="700" color={textColor}>
              Recently Added
            </Text>
            <Button
              size="xs"
              variant="ghost"
              color={brandColor}
              onClick={() => navigate("/bookmarks")}
              rightIcon={<MdArrowForward />}
            >
              View All
            </Button>
          </Flex>
          {recent.length === 0 ? (
            <Card>
              <Text color={subColor} textAlign="center" py="40px">
                No bookmarks yet. Go to Import to add your first batch.
              </Text>
            </Card>
          ) : (
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="14px">
              {recent.map((bm) => (
                <BookmarkCard
                  key={bm.id}
                  bookmark={bm}
                  onDelete={handleDelete}
                  onFavoriteToggle={handleFavoriteToggle}
                />
              ))}
            </SimpleGrid>
          )}
        </Box>

        <Box>
          <Text fontSize="sm" fontWeight="700" color={textColor} mb="10px">
            Top Authors
          </Text>
          <Card>
            {topAuthors.length === 0 ? (
              <Text color={subColor} textAlign="center" py="20px" fontSize="sm">
                No data yet
              </Text>
            ) : (
              <VStack spacing="10px" align="stretch">
                {topAuthors.map((author, i) => (
                  <Flex
                    key={author.name}
                    justify="space-between"
                    align="center"
                    cursor="pointer"
                    _hover={{ opacity: 0.7 }}
                    onClick={() => navigate(`/bookmarks?search=${encodeURIComponent(author.name)}`)}
                  >
                    <Flex align="center" gap="8px">
                      <Text fontSize="xs" fontWeight="700" color={subColor} w="18px">
                        {i + 1}
                      </Text>
                      <Text fontSize="sm" fontWeight="500" color={textColor}>
                        @{author.name}
                      </Text>
                    </Flex>
                    <Text fontSize="sm" fontWeight="600" color={brandColor}>
                      {author.count}
                    </Text>
                  </Flex>
                ))}
              </VStack>
            )}
          </Card>
        </Box>
      </SimpleGrid>
    </Box>
  );
}
