import { useState, useRef } from "react";
import {
  Box,
  Text,
  Textarea,
  Button,
  VStack,
  HStack,
  Input,
  Tag,
  TagLabel,
  TagCloseButton,
  useColorModeValue,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Code,
  Flex,
  Icon,
} from "@chakra-ui/react";
import { MdFileUpload, MdContentPaste, MdCheckCircle } from "react-icons/md";
import { useOutletContext } from "react-router-dom";
import Navbar from "../components/navbar/Navbar";
import Card from "../components/card/Card";
import { normalize, importBookmarks } from "../lib/db";

export default function Import() {
  const { onOpenSidebar } = useOutletContext();
  const [jsonText, setJsonText] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const textColor = useColorModeValue("secondaryGray.900", "white");
  const subColor = useColorModeValue("secondaryGray.600", "secondaryGray.600");
  const brandColor = useColorModeValue("brand.500", "brand.400");

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const removeTag = (tag) => setTags(tags.filter((t) => t !== tag));

  const doImport = async (rawJson) => {
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const parsed = JSON.parse(rawJson);
      const normalized = normalize(parsed);

      if (normalized.length === 0) {
        setError("No valid bookmarks found in the data. Check the format.");
        setLoading(false);
        return;
      }

      const { added, skipped } = await importBookmarks(normalized, tags);
      setResult({ added, skipped, total: normalized.length });
      setJsonText("");
    } catch (e) {
      setError(`Failed to parse JSON: ${e.message}`);
    }

    setLoading(false);
  };

  const handlePaste = () => doImport(jsonText);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    doImport(text);
  };

  return (
    <Box>
      <Navbar onOpen={onOpenSidebar} title="Import Bookmarks" />

      {result && (
        <Alert
          status="success"
          borderRadius="16px"
          mb="20px"
          variant="subtle"
        >
          <AlertIcon />
          <Box>
            <AlertTitle>Import Complete</AlertTitle>
            <AlertDescription>
              Added {result.added} new bookmarks.{" "}
              {result.skipped > 0 && `${result.skipped} duplicates skipped.`}
            </AlertDescription>
          </Box>
        </Alert>
      )}

      {error && (
        <Alert status="error" borderRadius="16px" mb="20px" variant="subtle">
          <AlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tags for this import batch */}
      <Card mb="20px">
        <Text fontSize="sm" fontWeight="700" color={textColor} mb="8px">
          Auto-tag this import batch (optional)
        </Text>
        <HStack mb="8px">
          <Input
            size="sm"
            placeholder="e.g. startups, ai, week-10"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            borderRadius="12px"
            maxW="250px"
          />
          <Button size="sm" variant="outline" onClick={addTag} borderRadius="12px">
            Add
          </Button>
        </HStack>
        {tags.length > 0 && (
          <HStack spacing="4px" wrap="wrap">
            {tags.map((t) => (
              <Tag key={t} size="sm" borderRadius="full" colorScheme="brand">
                <TagLabel>{t}</TagLabel>
                <TagCloseButton onClick={() => removeTag(t)} />
              </Tag>
            ))}
          </HStack>
        )}
      </Card>

      <Tabs variant="soft-rounded" colorScheme="brand">
        <TabList mb="16px">
          <Tab fontSize="sm">
            <Icon as={MdContentPaste} mr="6px" />
            Paste JSON
          </Tab>
          <Tab fontSize="sm">
            <Icon as={MdFileUpload} mr="6px" />
            Upload File
          </Tab>
        </TabList>

        <TabPanels>
          {/* Paste tab */}
          <TabPanel p="0">
            <Card>
              <Text fontSize="sm" color={subColor} mb="12px">
                Paste your exported JSON from Tampermonkey, bird CLI, or any X
                export tool. We auto-detect the format.
              </Text>
              <Textarea
                placeholder='[{"id": "123", "text": "...", ...}]'
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                minH="200px"
                fontFamily="mono"
                fontSize="xs"
                borderRadius="12px"
                mb="16px"
              />
              <Button
                colorScheme="brand"
                variant="solid"
                bg={brandColor}
                onClick={handlePaste}
                isLoading={loading}
                isDisabled={!jsonText.trim()}
                borderRadius="16px"
              >
                Import Bookmarks
              </Button>
            </Card>
          </TabPanel>

          {/* File upload tab */}
          <TabPanel p="0">
            <Card>
              <Text fontSize="sm" color={subColor} mb="16px">
                Upload a .json file exported from Tampermonkey or other tools.
              </Text>
              <Input
                ref={fileRef}
                type="file"
                accept=".json"
                display="none"
                onChange={handleFile}
              />
              <Flex
                direction="column"
                align="center"
                justify="center"
                border="2px dashed"
                borderColor={brandColor}
                borderRadius="16px"
                p="40px"
                cursor="pointer"
                onClick={() => fileRef.current?.click()}
                _hover={{ bg: "whiteAlpha.50" }}
                transition="all 0.2s"
              >
                <Icon as={MdFileUpload} w="40px" h="40px" color={brandColor} mb="12px" />
                <Text fontSize="sm" fontWeight="600" color={textColor}>
                  Click to upload JSON file
                </Text>
                <Text fontSize="xs" color={subColor} mt="4px">
                  .json files from Tampermonkey, bird CLI, X API exports
                </Text>
              </Flex>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Supported formats */}
      <Card mt="20px">
        <Text fontSize="sm" fontWeight="700" color={textColor} mb="12px">
          Supported Formats
        </Text>
        <VStack spacing="8px" align="stretch">
          {[
            "Twitter Web Exporter (Tampermonkey) — GraphQL intercept format",
            "bird CLI — likeCount/retweetCount format",
            "X API v2 — public_metrics format",
            "Raw GraphQL — tweet_results wrapper",
            "Generic — best-effort for any JSON with id + text fields",
          ].map((fmt) => (
            <Flex key={fmt} align="center" gap="8px">
              <Icon as={MdCheckCircle} color="green.400" />
              <Text fontSize="xs" color={subColor}>
                {fmt}
              </Text>
            </Flex>
          ))}
        </VStack>
      </Card>
    </Box>
  );
}
