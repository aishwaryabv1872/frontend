import { NextResponse } from "next/server";

export async function GET() {
  const problems = [
    {
      id: 1,
      problem_name: "Sum of Two Numbers",
      difficulty: "Easy",
      description:
        "Given two integers, find and print their sum.",
      inputFormat:
        "The first line contains two space-separated integers a and b.",
      outputFormat:
        "Print the sum of a and b.",
      examples: [
        {
          input: "5 7",
          output: "12",
        },
        {
          input: "10 20",
          output: "30",
        },
      ],
      starterCode: {
        python: `a, b = map(int, input().split())

# Write your solution here
`,
        cpp: `#include <iostream>
using namespace std;

int main() {
    int a, b;
    cin >> a >> b;

    // Write your solution here

    return 0;
}
`,
        javascript: `const input = require("fs")
  .readFileSync(0, "utf8")
  .trim()
  .split(/\\s+/)
  .map(Number);

const a = input[0];
const b = input[1];

// Write your solution here
`,
      },
    },

    {
      id: 2,
      problem_name: "Maximum Element",
      difficulty: "Easy",
      description:
        "Given N integers, find and print the maximum element.",
      inputFormat:
        "The first line contains N. The second line contains N space-separated integers.",
      outputFormat:
        "Print the maximum element.",
      examples: [
        {
          input: `5
1 8 3 2 6`,
          output: "8",
        },
        {
          input: `4
10 5 20 3`,
          output: "20",
        },
      ],
      starterCode: {
        python: `n = int(input())
arr = list(map(int, input().split()))

# Write your solution here
`,
        cpp: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    int n;
    cin >> n;

    vector<int> arr(n);

    for (int i = 0; i < n; i++) {
        cin >> arr[i];
    }

    // Write your solution here

    return 0;
}
`,
        javascript: `const input = require("fs")
  .readFileSync(0, "utf8")
  .trim()
  .split(/\\s+/)
  .map(Number);

let index = 0;

const n = input[index++];

const arr = [];

for (let i = 0; i < n; i++) {
  arr.push(input[index++]);
}

// Write your solution here
`,
      },
    },

    {
      id: 3,
      problem_name: "Count Even Numbers",
      difficulty: "Easy",
      description:
        "Given N integers, count how many of them are even.",
      inputFormat:
        "The first line contains N. The second line contains N space-separated integers.",
      outputFormat:
        "Print the count of even numbers.",
      examples: [
        {
          input: `6
1 2 3 4 5 6`,
          output: "3",
        },
        {
          input: `5
2 4 6 8 10`,
          output: "5",
        },
      ],
      starterCode: {
        python: `n = int(input())
arr = list(map(int, input().split()))

# Write your solution here
`,
        cpp: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    int n;
    cin >> n;

    vector<int> arr(n);

    for (int i = 0; i < n; i++) {
        cin >> arr[i];
    }

    // Write your solution here

    return 0;
}
`,
        javascript: `const input = require("fs")
  .readFileSync(0, "utf8")
  .trim()
  .split(/\\s+/)
  .map(Number);

let index = 0;

const n = input[index++];

const arr = [];

for (let i = 0; i < n; i++) {
  arr.push(input[index++]);
}

// Write your solution here
`,
      },
    },

    {
      id: 4,
      problem_name: "Reverse a String",
      difficulty: "Easy",
      description:
        "Given a string, reverse it and print the reversed string.",
      inputFormat:
        "The input contains a single string.",
      outputFormat:
        "Print the reversed string.",
      examples: [
        {
          input: "hello",
          output: "olleh",
        },
        {
          input: "vertex",
          output: "xetrev",
        },
      ],
      starterCode: {
        python: `s = input()

# Write your solution here
`,
        cpp: `#include <iostream>
#include <algorithm>
using namespace std;

int main() {
    string s;
    cin >> s;

    // Write your solution here

    return 0;
}
`,
        javascript: `const fs = require("fs");

const input = fs.readFileSync(0, "utf8").trim();

const s = input;

// Write your solution here
`,
      },
    },

    {
      id: 5,
      problem_name: "Factorial",
      difficulty: "Easy",
      description:
        "Given a non-negative integer N, find its factorial.",
      inputFormat:
        "The input contains a single non-negative integer N.",
      outputFormat:
        "Print N factorial.",
      examples: [
        {
          input: "5",
          output: "120",
        },
        {
          input: "0",
          output: "1",
        },
      ],
      starterCode: {
        python: `n = int(input())

# Write your solution here
`,
        cpp: `#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;

    // Write your solution here

    return 0;
}
`,
        javascript: `const fs = require("fs");

const input = fs.readFileSync(0, "utf8").trim();

const n = Number(input);

// Write your solution here
`,
      },
    },

    // ⭐ PROBLEM #6
    {
      id: 6,
      problem_name: "Find the Second Largest Element",
      difficulty: "Easy",
      description:
        "Given N integers, find the second largest distinct element. If there is no second largest distinct element, print -1.",
      inputFormat: `The first line contains N.
The second line contains N space-separated integers.`,
      outputFormat:
        "Print the second largest distinct element. If it does not exist, print -1.",
      examples: [
        {
          input: `5
10 5 8 20 15`,
          output: "15",
        },
        {
          input: `6
7 7 2 9 4 1`,
          output: "7",
        },
        {
          input: `4
10 10 10 10`,
          output: "-1",
        },
        {
          input: `5
-10 -5 -20 -3 -8`,
          output: "-5",
        },
      ],
      starterCode: {
        python: `n = int(input())
arr = list(map(int, input().split()))

# Write your solution here
`,
        cpp: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    int n;
    cin >> n;

    vector<int> arr(n);

    for (int i = 0; i < n; i++) {
        cin >> arr[i];
    }

    // Write your solution here

    return 0;
}
`,
        javascript: `const input = require("fs")
  .readFileSync(0, "utf8")
  .trim()
  .split(/\\s+/)
  .map(Number);

let index = 0;

const n = input[index++];

const arr = [];

for (let i = 0; i < n; i++) {
  arr.push(input[index++]);
}

// Write your solution here
`,
      },
    },
  ];

  return NextResponse.json({
    success: true,
    problems,
  });
}