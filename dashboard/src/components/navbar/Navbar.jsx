import { useState } from "react";
import {
  Box,
  Flex,
  Text,
  IconButton,
  useColorMode,
  useColorModeValue,
  Input,
  InputGroup,
  InputLeftElement,
} from "@chakra-ui/react";
import { MdMenu, MdDarkMode, MdLightMode, MdSearch } from "react-icons/md";
import { useNavigate } from "react-router-dom";

export default function Navbar({ onOpen, title }) {
  const { colorMode, toggleColorMode } = useColorMode();
  const navigate = useNavigate();
  const [searchVal, setSearchVal] = useState("");
  const navbarBg = useColorModeValue(
    "rgba(244,247,254,0.2)",
    "rgba(11,20,55,0.5)"
  );
  const textColor = useColorModeValue("secondaryGray.900", "white");
  const inputBg = useColorModeValue("white", "navy.800");

  const handleSearch = (e) => {
    if (e.key === "Enter" && searchVal.trim()) {
      navigate(`/bookmarks?search=${encodeURIComponent(searchVal.trim())}`);
      setSearchVal("");
    }
  };

  return (
    <Flex
      position="sticky"
      top="0"
      zIndex="10"
      bg={navbarBg}
      backdropFilter="blur(20px)"
      px={{ base: "16px", md: "30px" }}
      py="14px"
      align="center"
      justify="space-between"
      borderRadius="16px"
      mb="20px"
    >
      <Flex align="center" gap="12px">
        <IconButton
          display={{ base: "flex", xl: "none" }}
          icon={<MdMenu />}
          variant="ghost"
          onClick={onOpen}
          aria-label="Open menu"
          color={textColor}
        />
        <Text fontSize="lg" fontWeight="700" color={textColor}>
          {title}
        </Text>
      </Flex>

      <Flex align="center" gap="8px">
        <InputGroup size="sm" display={{ base: "none", md: "flex" }} maxW="200px">
          <InputLeftElement>
            <MdSearch color="gray" />
          </InputLeftElement>
          <Input
            placeholder="Search..."
            bg={inputBg}
            borderRadius="12px"
            border="none"
            fontSize="sm"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            onKeyDown={handleSearch}
          />
        </InputGroup>
        <IconButton
          icon={colorMode === "dark" ? <MdLightMode /> : <MdDarkMode />}
          onClick={toggleColorMode}
          variant="ghost"
          aria-label="Toggle color mode"
          color={textColor}
          size="sm"
        />
      </Flex>
    </Flex>
  );
}
