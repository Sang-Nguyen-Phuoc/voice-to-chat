/**
 * Function Registry - Tool definitions and implementations
 * Contains all functions that OpenAI can call during conversations
 */

// Function definitions following OpenAI function calling format
export const functionDefinitions = [
  {
    type: 'function',
    name: 'getCurrentWeather',
    description: 'Lấy thông tin thời tiết hiện tại của một thành phố. Sử dụng khi người dùng hỏi về thời tiết.',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'Tên thành phố, ví dụ: Hà Nội, Hồ Chí Minh',
        },
        country: {
          type: 'string',
          description: 'Tên quốc gia, ví dụ: Việt Nam, Vietnam',
          default: 'Việt Nam',
        },
      },
      required: ['city'],
    },
  },
  {
    type: 'function',
    name: 'getCurrentTime',
    description: 'Lấy thời gian hiện tại. Sử dụng khi người dùng hỏi mấy giờ, thời gian bây giờ.',
    parameters: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'Múi giờ, ví dụ: Asia/Ho_Chi_Minh',
          default: 'Asia/Ho_Chi_Minh',
        },
      },
      required: [],
    },
  },
  {
    type: 'function',
    name: 'searchWikipedia',
    description: 'Tìm kiếm thông tin trên Wikipedia tiếng Việt. Sử dụng khi người dùng muốn tìm hiểu về một chủ đề, nhân vật, sự kiện.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Từ khóa tìm kiếm',
        },
      },
      required: ['query'],
    },
  },
];

/**
 * Execute a function call from OpenAI
 * @param functionName - Name of the function to execute
 * @param argumentsJson - JSON string containing function arguments
 * @returns Promise with function result
 */
export async function executeFunctionCall(
  functionName: string,
  argumentsJson: string
): Promise<any> {
  console.log(`\n[Function] 🔧 Executing: ${functionName}`);

  let args;
  try {
    args = JSON.parse(argumentsJson);
  } catch (error) {
    console.error('[Function] ❌ Failed to parse arguments:', error);
    return { error: 'Invalid arguments format' };
  }

  console.log(`[Function] 📋 Arguments:`, args);

  try {
    let result;

    switch (functionName) {
      case 'getCurrentWeather':
        result = await getCurrentWeather(args.city, args.country);
        break;

      case 'getCurrentTime':
        result = await getCurrentTime(args.timezone);
        break;

      case 'searchWikipedia':
        result = await searchWikipedia(args.query);
        break;

      default:
        result = { error: `Unknown function: ${functionName}` };
    }

    console.log(`[Function] ✅ Result:`, result);
    return result;
  } catch (error) {
    console.error(`[Function] ❌ Error executing ${functionName}:`, error);
    return { error: 'Function execution failed' };
  }
}

/**
 * Get current weather for a city (mock data for POC)
 * In production, this would call a real weather API like OpenWeatherMap
 */
async function getCurrentWeather(city: string, country: string = 'Việt Nam'): Promise<any> {
  // Mock weather data for demo purposes
  const mockWeatherData: Record<string, any> = {
    'Hà Nội': {
      temperature: 28,
      description: 'Trời nắng, có mây',
      humidity: 65,
      wind_speed: 12,
    },
    'Hồ Chí Minh': {
      temperature: 32,
      description: 'Trời nắng nóng',
      humidity: 75,
      wind_speed: 8,
    },
    'Đà Nẵng': {
      temperature: 30,
      description: 'Trời quang đãng',
      humidity: 70,
      wind_speed: 15,
    },
  };

  const normalizedCity = city.trim();
  const weatherData = mockWeatherData[normalizedCity] || {
    temperature: 27,
    description: 'Trời nhiều mây',
    humidity: 68,
    wind_speed: 10,
  };

  return {
    city: normalizedCity,
    country,
    temperature: weatherData.temperature,
    description: weatherData.description,
    humidity: weatherData.humidity,
    wind_speed: weatherData.wind_speed,
    unit: 'Celsius',
  };
}

/**
 * Get current time in specified timezone
 */
async function getCurrentTime(timezone: string = 'Asia/Ho_Chi_Minh'): Promise<any> {
  const now = new Date();

  const timeString = now.toLocaleString('vi-VN', {
    timeZone: timezone,
    dateStyle: 'full',
    timeStyle: 'long',
  });

  return {
    timezone,
    current_time: timeString,
    timestamp: now.toISOString(),
  };
}

/**
 * Search Wikipedia for information
 */
async function searchWikipedia(query: string): Promise<any> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://vi.wikipedia.org/api/rest_v1/page/summary/${encodedQuery}`;

    const response = await fetch(url);

    if (!response.ok) {
      return {
        error: 'Không tìm thấy thông tin',
        query,
      };
    }

    const data = await response.json();

    return {
      title: data.title,
      summary: data.extract,
      url: data.content_urls?.desktop?.page || '',
      query,
    };
  } catch (error) {
    console.error('[Wikipedia] ❌ Search error:', error);
    return {
      error: 'Lỗi khi tìm kiếm Wikipedia',
      query,
    };
  }
}
