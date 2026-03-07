import { useEffect, useState } from "react";
import {
  Box,
  SimpleGrid,
  Text,
  Button,
  Textarea,
  Flex,
  useColorModeValue,
  useToast,
  HStack,
  Badge,
  Icon,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Select,
} from "@chakra-ui/react";
import { MdContentCopy, MdDownload, MdArrowForward } from "react-icons/md";
import { useOutletContext, useLocation } from "react-router-dom";
import Navbar from "../components/navbar/Navbar";
import Card from "../components/card/Card";
import { db } from "../lib/db";
import { promptTemplates, generatePrompt } from "../lib/prompts";

export default function Export() {
  const { onOpenSidebar } = useOutletContext();
  const location = useLocation();
  const toast = useToast();

  const [bookmarks, setBookmarks] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [limit, setLimit] = useState(20);
  const [sortExportBy, setSortExportBy] = useState("likes-desc");

  const textColor = useColorModeValue("secondaryGray.900", "white");
  const subColor = useColorModeValue("secondaryGray.600", "secondaryGray.600");
  const brandColor = useColorModeValue("brand.500", "brand.400");
  const cardBg = useColorModeValue("white", "navy.700");

  useEffect(() => {
    async function load() {
      const all = await db.bookmarks.toArray();
      setBookmarks(all);

      // Pre-select if coming from bookmarks page
      if (location.state?.selectedIds) {
        setSelectedIds(new Set(location.state.selectedIds));
      }
    }
    load();
  }, [location.state]);

  const getExportBookmarks = () => {
    let pool = selectedIds.size > 0
      ? bookmarks.filter((bm) => selectedIds.has(bm.id))
      : bookmarks;

    // Sort
    const [field, dir] = sortExportBy.split("-");
    pool = [...pool].sort((a, b) => {
      const va = a[field] || 0;
      const vb = b[field] || 0;
      return dir === "desc" ? vb - va : va - vb;
    });

    return pool.slice(0, limit);
  };

  const handleSelectTemplate = (key) => {
    const exportBms = getExportBookmarks();
    const prompt = generatePrompt(key, exportBms);
    setActiveTemplate(key);
    setGeneratedPrompt(prompt);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      toast({
        title: "Copied to clipboard",
        description: "Paste into Claude to get started",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = generatedPrompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast({
        title: "Copied!",
        status: "success",
        duration: 2000,
        position: "top",
      });
    }
  };

  const downloadJSON = () => {
    const exportBms = getExportBookmarks();
    const blob = new Blob([JSON.stringify(exportBms, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `x-bookmarks-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPrompt = () => {
    if (!generatedPrompt) return;
    const blob = new Blob([generatedPrompt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claude-prompt-${activeTemplate}-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <Navbar onOpen={onOpenSidebar} title="Export to Claude" />

      {/* Config */}
      <Card mb="20px">
        <Text fontSize="sm" fontWeight="700" color={textColor} mb="12px">
          Export Settings
        </Text>
        <Flex gap="16px" wrap="wrap" align="center">
          <Box>
            <Text fontSize="xs" color={subColor} mb="4px">
              Max bookmarks to include
            </Text>
            <NumberInput
              size="sm"
              value={limit}
              onChange={(_, v) => setLimit(v)}
              min={1}
              max={200}
              maxW="100px"
            >
              <NumberInputField borderRadius="12px" />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </Box>

          <Box>
            <Text fontSize="xs" color={subColor} mb="4px">
              Sort by
            </Text>
            <Select
              size="sm"
              value={sortExportBy}
              onChange={(e) => setSortExportBy(e.target.value)}
              borderRadius="12px"
              maxW="180px"
            >
              <option value="likes-desc">Most Liked</option>
              <option value="retweets-desc">Most Retweeted</option>
              <option value="views-desc">Most Viewed</option>
              <option value="created_at-desc">Newest</option>
            </Select>
          </Box>

          <Box>
            <Text fontSize="xs" color={subColor} mb="4px">
              Source
            </Text>
            <Badge colorScheme={selectedIds.size > 0 ? "brand" : "gray"} fontSize="sm" borderRadius="8px" px="8px" py="4px">
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : `All (${bookmarks.length})`}
            </Badge>
          </Box>
        </Flex>

        <HStack mt="16px">
          <Button
            size="sm"
            leftIcon={<MdDownload />}
            variant="outline"
            borderRadius="12px"
            onClick={downloadJSON}
          >
            Download Raw JSON
          </Button>
        </HStack>
      </Card>

      {/* Prompt Templates */}
      <Text fontSize="sm" fontWeight="700" color={textColor} mb="12px">
        Choose a Prompt Template
      </Text>
      <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="16px" mb="20px">
        {Object.entries(promptTemplates).map(([key, tmpl]) => (
          <Card
            key={key}
            cursor="pointer"
            onClick={() => handleSelectTemplate(key)}
            border="2px solid"
            borderColor={activeTemplate === key ? brandColor : "transparent"}
            _hover={{
              borderColor: activeTemplate === key ? brandColor : "whiteAlpha.200",
              transform: "translateY(-2px)",
            }}
            transition="all 0.15s"
          >
            <Flex align="center" gap="8px" mb="8px">
              <Text fontSize="xl">{tmpl.icon}</Text>
              <Text fontSize="sm" fontWeight="700" color={textColor}>
                {tmpl.name}
              </Text>
            </Flex>
            <Text fontSize="xs" color={subColor}>
              {tmpl.description}
            </Text>
            <Flex justify="flex-end" mt="12px">
              <Icon as={MdArrowForward} color={brandColor} />
            </Flex>
          </Card>
        ))}
      </SimpleGrid>

      {/* Generated prompt */}
      {generatedPrompt && (
        <Card>
          <Flex justify="space-between" align="center" mb="12px">
            <Text fontSize="sm" fontWeight="700" color={textColor}>
              Generated Prompt ({getExportBookmarks().length} bookmarks)
            </Text>
            <HStack>
              <Button
                size="sm"
                leftIcon={<MdContentCopy />}
                colorScheme="brand"
                variant="solid"
                bg={brandColor}
                borderRadius="12px"
                onClick={copyToClipboard}
              >
                Copy to Clipboard
              </Button>
              <Button
                size="sm"
                leftIcon={<MdDownload />}
                variant="outline"
                borderRadius="12px"
                onClick={downloadPrompt}
              >
                Download .txt
              </Button>
            </HStack>
          </Flex>
          <Textarea
            value={generatedPrompt}
            readOnly
            minH="300px"
            fontFamily="mono"
            fontSize="xs"
            borderRadius="12px"
            bg={cardBg}
          />
        </Card>
      )}
    </Box>
  );
}
